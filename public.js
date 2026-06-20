// src/routes/public.js
// Rotas públicas (sem login): exibir a pesquisa pelo link e receber respostas.
// Anti-duplicação em 3 camadas — bloqueia se QUALQUER sinal já existir na pesquisa:
//   1) cookie do visitante (visitor_id)
//   2) fingerprint do navegador (enviado pelo front)
//   3) hash do IP (com salt; nunca guardamos o IP cru)

const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');

const router = express.Router();

const IP_SALT = process.env.IP_SALT || 'troque-este-salt';
const IP_DEDUP = process.env.IP_DEDUP !== 'false'; // padrão: ligado
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
const VISITOR_COOKIE = 'visitor_id';

const MAX_TEXTO_CURTO = 500;
const MAX_TEXTO_LONGO = 5000;

function hashIp(ip) {
  return crypto.createHash('sha256').update(`${ip || ''}|${IP_SALT}`).digest('hex');
}

function visitorCookieOptions() {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 ano
    path: '/',
  };
}

// GET /api/p/:slug  -> pesquisa publicada (perguntas + opções), sem dados de dedup
router.get('/:slug', async (req, res) => {
  try {
    const s = (await pool.query('SELECT * FROM surveys WHERE slug = $1', [req.params.slug])).rows[0];
    if (!s) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
    if (s.status !== 'publicada') {
      return res.status(403).json({ error: 'Esta pesquisa não está aberta para respostas.' });
    }

    const questions = (
      await pool.query(
        `SELECT id, type, text, position, required, scale_min, scale_max
         FROM questions WHERE survey_id = $1 ORDER BY position`,
        [s.id]
      )
    ).rows;
    const qIds = questions.map((q) => q.id);
    let options = [];
    if (qIds.length) {
      options = (
        await pool.query(
          'SELECT id, question_id, text, position FROM options WHERE question_id = ANY($1) ORDER BY position',
          [qIds]
        )
      ).rows;
    }
    const porPergunta = {};
    for (const o of options) (porPergunta[o.question_id] = porPergunta[o.question_id] || []).push(o);

    // Garante um cookie de visitante já na abertura (ajuda no dedup do envio).
    if (!req.cookies || !req.cookies[VISITOR_COOKIE]) {
      res.cookie(VISITOR_COOKIE, crypto.randomUUID(), visitorCookieOptions());
    }

    res.json({
      id: s.id,
      slug: s.slug,
      title: s.title,
      description: s.description,
      questions: questions.map((q) => ({ ...q, options: porPergunta[q.id] || [] })),
    });
  } catch (e) {
    console.error('[public] abrir pesquisa:', e.message);
    res.status(500).json({ error: 'Erro ao abrir a pesquisa.' });
  }
});

// Valida o conjunto de respostas contra as perguntas e devolve as linhas a inserir.
function validarRespostas(questions, optionsPorPergunta, respostas) {
  const linhas = []; // { question_id, option_id, text_value, scale_value }
  for (const q of questions) {
    const valor = respostas ? respostas[String(q.id)] : undefined;
    const vazio =
      valor === undefined ||
      valor === null ||
      (Array.isArray(valor) && valor.length === 0) ||
      (typeof valor === 'string' && valor.trim() === '');

    if (vazio) {
      if (q.required) return { erro: `A pergunta "${q.text}" é obrigatória.` };
      continue;
    }

    if (q.type === 'unica') {
      const optId = Number(valor);
      const ok = (optionsPorPergunta[q.id] || []).some((o) => o.id === optId);
      if (!ok) return { erro: `Opção inválida na pergunta "${q.text}".` };
      linhas.push({ question_id: q.id, option_id: optId, text_value: null, scale_value: null });
    } else if (q.type === 'multipla') {
      const arr = Array.isArray(valor) ? valor : [valor];
      const validos = new Set((optionsPorPergunta[q.id] || []).map((o) => o.id));
      const escolhidos = [...new Set(arr.map(Number))];
      for (const optId of escolhidos) {
        if (!validos.has(optId)) return { erro: `Opção inválida na pergunta "${q.text}".` };
        linhas.push({ question_id: q.id, option_id: optId, text_value: null, scale_value: null });
      }
    } else if (q.type === 'escala') {
      const n = Number(valor);
      if (!Number.isInteger(n) || n < q.scale_min || n > q.scale_max) {
        return { erro: `Valor fora da escala na pergunta "${q.text}".` };
      }
      linhas.push({ question_id: q.id, option_id: null, text_value: null, scale_value: n });
    } else {
      // texto_curto / texto_longo
      const limite = q.type === 'texto_curto' ? MAX_TEXTO_CURTO : MAX_TEXTO_LONGO;
      const txt = String(valor).trim().slice(0, limite);
      linhas.push({ question_id: q.id, option_id: null, text_value: txt, scale_value: null });
    }
  }
  return { linhas };
}

// POST /api/p/:slug/submit  { fingerprint, answers: { "<questionId>": valor } }
router.post('/:slug/submit', async (req, res) => {
  const { fingerprint, answers } = req.body || {};

  const client = await pool.connect();
  try {
    const s = (await client.query('SELECT * FROM surveys WHERE slug = $1', [req.params.slug])).rows[0];
    if (!s) {
      return res.status(404).json({ error: 'Pesquisa não encontrada.' });
    }
    if (s.status !== 'publicada') {
      return res.status(403).json({ error: 'Esta pesquisa não está aberta para respostas.' });
    }

    // Sinais de identificação
    let visitorId = req.cookies ? req.cookies[VISITOR_COOKIE] : null;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      res.cookie(VISITOR_COOKIE, visitorId, visitorCookieOptions());
    }
    const fp = fingerprint ? String(fingerprint).slice(0, 200) : null;
    const ipHash = hashIp(req.ip);

    // --- Dedup: bloqueia se qualquer sinal já existir nesta pesquisa ---
    const dup = await client.query(
      `SELECT 1 FROM responses
       WHERE survey_id = $1
         AND ( visitor_cookie = $2
            OR ($3::text IS NOT NULL AND fingerprint = $3)
            OR ($4::boolean AND ip_hash = $5) )
       LIMIT 1`,
      [s.id, visitorId, fp, IP_DEDUP, ipHash]
    );
    if (dup.rowCount > 0) {
      return res.status(409).json({ error: 'Você já respondeu esta pesquisa.' });
    }

    // Carrega perguntas + opções para validar
    const questions = (
      await client.query('SELECT * FROM questions WHERE survey_id = $1 ORDER BY position', [s.id])
    ).rows;
    const qIds = questions.map((q) => q.id);
    let options = [];
    if (qIds.length) {
      options = (
        await client.query('SELECT id, question_id FROM options WHERE question_id = ANY($1)', [qIds])
      ).rows;
    }
    const optionsPorPergunta = {};
    for (const o of options) (optionsPorPergunta[o.question_id] = optionsPorPergunta[o.question_id] || []).push(o);

    const { erro, linhas } = validarRespostas(questions, optionsPorPergunta, answers);
    if (erro) return res.status(400).json({ error: erro });

    // --- Grava resposta + itens em transação ---
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO responses (survey_id, visitor_cookie, fingerprint, ip_hash)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [s.id, visitorId, fp, ipHash]
    );
    const responseId = r.rows[0].id;
    for (const a of linhas) {
      await client.query(
        `INSERT INTO answers (response_id, question_id, option_id, text_value, scale_value)
         VALUES ($1,$2,$3,$4,$5)`,
        [responseId, a.question_id, a.option_id, a.text_value, a.scale_value]
      );
    }
    await client.query('COMMIT');

    res.status(201).json({ ok: true });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[public] enviar resposta:', e.message);
    res.status(500).json({ error: 'Erro ao registrar sua resposta.' });
  } finally {
    client.release();
  }
});

module.exports = router;
