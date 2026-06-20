// src/routes/admin.js
// Rotas protegidas do painel admin: login, CRUD de pesquisas, mudança de status,
// resultados agregados e exportação CSV.

const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const {
  signAdminToken,
  safeEqual,
  requireAdmin,
  adminCookieOptions,
  TOKEN_COOKIE,
} = require('../auth');

const router = express.Router();

const TIPOS_VALIDOS = ['unica', 'multipla', 'texto_curto', 'texto_longo', 'escala'];
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// ---- helpers --------------------------------------------------------------

function gerarSlug(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

const idValido = (v) => /^\d+$/.test(String(v));

// ---- login ----------------------------------------------------------------

// POST /api/admin/login  { password }
router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD não está configurada no servidor.' });
  }
  if (!password || !safeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  const token = signAdminToken();
  res.cookie(TOKEN_COOKIE, token, adminCookieOptions());
  res.json({ ok: true, token }); // token também no corpo (uso via Bearer)
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  res.clearCookie(TOKEN_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// GET /api/admin/me  -> confirma sessão
router.get('/me', requireAdmin, (req, res) => res.json({ ok: true, admin: true }));

// ---- validação de perguntas ----------------------------------------------

function validarPerguntas(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return 'Inclua ao menos uma pergunta.';
  }
  for (const q of questions) {
    if (!TIPOS_VALIDOS.includes(q.type)) return `Tipo de pergunta inválido: ${q.type}`;
    if (!q.text || !String(q.text).trim()) return 'Toda pergunta precisa de um texto.';
    if (q.type === 'unica' || q.type === 'multipla') {
      if (!Array.isArray(q.options) || q.options.filter((o) => String(o).trim()).length < 2) {
        return 'Perguntas de escolha precisam de ao menos 2 opções.';
      }
    }
    if (q.type === 'escala') {
      const min = Number.isInteger(q.scale_min) ? q.scale_min : 1;
      const max = Number.isInteger(q.scale_max) ? q.scale_max : 5;
      if (max <= min) return 'Na escala, o valor máximo deve ser maior que o mínimo.';
    }
  }
  return null;
}

// Insere perguntas + opções de uma pesquisa (dentro de uma transação existente).
async function inserirPerguntas(client, surveyId, questions) {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ehEscala = q.type === 'escala';
    const scaleMin = ehEscala ? (Number.isInteger(q.scale_min) ? q.scale_min : 1) : null;
    const scaleMax = ehEscala ? (Number.isInteger(q.scale_max) ? q.scale_max : 5) : null;
    const qr = await client.query(
      `INSERT INTO questions (survey_id, type, text, position, required, scale_min, scale_max)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [surveyId, q.type, String(q.text).trim(), i, q.required !== false, scaleMin, scaleMax]
    );
    const qid = qr.rows[0].id;
    if (q.type === 'unica' || q.type === 'multipla') {
      const opts = q.options.map((o) => String(o).trim()).filter(Boolean);
      for (let j = 0; j < opts.length; j++) {
        await client.query(
          'INSERT INTO options (question_id, text, position) VALUES ($1,$2,$3)',
          [qid, opts[j], j]
        );
      }
    }
  }
}

// ---- CRUD de pesquisas -----------------------------------------------------

// GET /api/admin/surveys  -> lista com contagem de respostas
router.get('/surveys', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.slug, s.title, s.description, s.status, s.created_at, s.updated_at,
             (SELECT count(*) FROM responses r WHERE r.survey_id = s.id)::int AS responses
      FROM surveys s
      ORDER BY s.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[admin] listar surveys:', e.message);
    res.status(500).json({ error: 'Erro ao listar pesquisas.' });
  }
});

// POST /api/admin/surveys  -> cria pesquisa (status rascunho)
router.post('/surveys', requireAdmin, async (req, res) => {
  const { title, description, questions } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'O título é obrigatório.' });
  }
  const erro = validarPerguntas(questions);
  if (erro) return res.status(400).json({ error: erro });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let inserted = null;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const slug = gerarSlug();
      try {
        const r = await client.query(
          'INSERT INTO surveys (slug, title, description) VALUES ($1,$2,$3) RETURNING id, slug',
          [slug, String(title).trim(), description ? String(description).trim() : null]
        );
        inserted = r.rows[0];
      } catch (e) {
        if (e.code === '23505') continue; // slug colidiu, tenta outro
        throw e;
      }
    }
    if (!inserted) throw new Error('Não foi possível gerar um link único.');
    await inserirPerguntas(client, inserted.id, questions);
    await client.query('COMMIT');
    res.status(201).json({ id: inserted.id, slug: inserted.slug });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[admin] criar survey:', e.message);
    res.status(500).json({ error: 'Erro ao criar a pesquisa.' });
  } finally {
    client.release();
  }
});

// GET /api/admin/surveys/:id  -> detalhe com perguntas e opções
router.get('/surveys/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
  try {
    const s = (await pool.query('SELECT * FROM surveys WHERE id = $1', [id])).rows[0];
    if (!s) return res.status(404).json({ error: 'Pesquisa não encontrada.' });

    const questions = (
      await pool.query('SELECT * FROM questions WHERE survey_id = $1 ORDER BY position', [id])
    ).rows;
    const qIds = questions.map((q) => q.id);
    let options = [];
    if (qIds.length) {
      options = (
        await pool.query('SELECT * FROM options WHERE question_id = ANY($1) ORDER BY position', [qIds])
      ).rows;
    }
    const porPergunta = {};
    for (const o of options) (porPergunta[o.question_id] = porPergunta[o.question_id] || []).push(o);
    s.questions = questions.map((q) => ({ ...q, options: porPergunta[q.id] || [] }));
    res.json(s);
  } catch (e) {
    console.error('[admin] detalhe survey:', e.message);
    res.status(500).json({ error: 'Erro ao buscar a pesquisa.' });
  }
});

// PUT /api/admin/surveys/:id  -> atualiza título/descrição; e perguntas SÓ se rascunho
router.put('/surveys/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
  const { title, description, questions } = req.body || {};
  if (title !== undefined && !String(title).trim()) {
    return res.status(400).json({ error: 'O título não pode ficar vazio.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const s = (await client.query('SELECT * FROM surveys WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!s) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pesquisa não encontrada.' });
    }

    await client.query(
      `UPDATE surveys SET
         title = COALESCE($2, title),
         description = $3,
         updated_at = now()
       WHERE id = $1`,
      [id, title !== undefined ? String(title).trim() : null,
       description !== undefined ? (description ? String(description).trim() : null) : s.description]
    );

    // Estrutura (perguntas) só pode ser trocada enquanto for rascunho,
    // pra não corromper respostas já coletadas.
    if (questions !== undefined) {
      if (s.status !== 'rascunho') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Só é possível alterar as perguntas enquanto a pesquisa está em rascunho.',
        });
      }
      const erro = validarPerguntas(questions);
      if (erro) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: erro });
      }
      await client.query('DELETE FROM questions WHERE survey_id = $1', [id]); // cascata nas opções
      await inserirPerguntas(client, id, questions);
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[admin] atualizar survey:', e.message);
    res.status(500).json({ error: 'Erro ao atualizar a pesquisa.' });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/surveys/:id
router.delete('/surveys/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
  try {
    const r = await pool.query('DELETE FROM surveys WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin] excluir survey:', e.message);
    res.status(500).json({ error: 'Erro ao excluir a pesquisa.' });
  }
});

// ---- mudança de status -----------------------------------------------------

function mudarStatus(novoStatus) {
  return async (req, res) => {
    const { id } = req.params;
    if (!idValido(id)) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
    try {
      const r = await pool.query(
        'UPDATE surveys SET status = $2, updated_at = now() WHERE id = $1 RETURNING id, status',
        [id, novoStatus]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
      res.json({ ok: true, status: r.rows[0].status });
    } catch (e) {
      console.error('[admin] mudar status:', e.message);
      res.status(500).json({ error: 'Erro ao mudar o status.' });
    }
  };
}

router.post('/surveys/:id/publish', requireAdmin, mudarStatus('publicada'));
router.post('/surveys/:id/close', requireAdmin, mudarStatus('encerrada'));
router.post('/surveys/:id/reopen', requireAdmin, mudarStatus('publicada'));

// ---- resultados ------------------------------------------------------------

// Monta a agregação por pergunta. Reaproveitado pelo JSON e pelo CSV.
async function montarResultados(id) {
  const s = (await pool.query('SELECT * FROM surveys WHERE id = $1', [id])).rows[0];
  if (!s) return null;

  const total = (
    await pool.query('SELECT count(*)::int AS n FROM responses WHERE survey_id = $1', [id])
  ).rows[0].n;

  const questions = (
    await pool.query('SELECT * FROM questions WHERE survey_id = $1 ORDER BY position', [id])
  ).rows;

  const resultados = [];
  for (const q of questions) {
    const base = { id: q.id, text: q.text, type: q.type };

    if (q.type === 'unica' || q.type === 'multipla') {
      const opts = (
        await pool.query('SELECT id, text FROM options WHERE question_id = $1 ORDER BY position', [q.id])
      ).rows;
      const counts = (
        await pool.query(
          `SELECT option_id, count(*)::int AS n
           FROM answers WHERE question_id = $1 AND option_id IS NOT NULL
           GROUP BY option_id`,
          [q.id]
        )
      ).rows;
      const mapa = {};
      for (const c of counts) mapa[c.option_id] = c.n;
      base.options = opts.map((o) => ({ id: o.id, text: o.text, votes: mapa[o.id] || 0 }));
    } else if (q.type === 'escala') {
      const dist = (
        await pool.query(
          `SELECT scale_value AS valor, count(*)::int AS n
           FROM answers WHERE question_id = $1 AND scale_value IS NOT NULL
           GROUP BY scale_value ORDER BY scale_value`,
          [q.id]
        )
      ).rows;
      const media = (
        await pool.query(
          'SELECT avg(scale_value)::numeric(10,2) AS media FROM answers WHERE question_id = $1 AND scale_value IS NOT NULL',
          [q.id]
        )
      ).rows[0].media;
      base.scale_min = q.scale_min;
      base.scale_max = q.scale_max;
      base.distribution = dist;
      base.average = media === null ? null : Number(media);
    } else {
      // texto_curto / texto_longo
      const textos = (
        await pool.query(
          `SELECT text_value FROM answers
           WHERE question_id = $1 AND text_value IS NOT NULL AND text_value <> ''
           ORDER BY id`,
          [q.id]
        )
      ).rows.map((r) => r.text_value);
      base.answers = textos;
    }
    resultados.push(base);
  }
  return { survey: { id: s.id, title: s.title, status: s.status }, total, questions: resultados };
}

// GET /api/admin/surveys/:id/results  -> JSON agregado
router.get('/surveys/:id/results', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
  try {
    const out = await montarResultados(id);
    if (!out) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
    res.json(out);
  } catch (e) {
    console.error('[admin] resultados:', e.message);
    res.status(500).json({ error: 'Erro ao montar os resultados.' });
  }
});

// ---- CSV (uma linha por resposta, uma coluna por pergunta) ------------------

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/admin/surveys/:id/results.csv
router.get('/surveys/:id/results.csv', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!idValido(id)) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
  try {
    const s = (await pool.query('SELECT * FROM surveys WHERE id = $1', [id])).rows[0];
    if (!s) return res.status(404).json({ error: 'Pesquisa não encontrada.' });

    const questions = (
      await pool.query('SELECT * FROM questions WHERE survey_id = $1 ORDER BY position', [id])
    ).rows;

    // Texto das opções para traduzir option_id -> texto
    const opts = (
      await pool.query(
        `SELECT o.id, o.text FROM options o
         JOIN questions q ON q.id = o.question_id WHERE q.survey_id = $1`,
        [id]
      )
    ).rows;
    const textoOpcao = {};
    for (const o of opts) textoOpcao[o.id] = o.text;

    const responses = (
      await pool.query('SELECT id, created_at FROM responses WHERE survey_id = $1 ORDER BY created_at', [id])
    ).rows;
    const respIds = responses.map((r) => r.id);

    let answers = [];
    if (respIds.length) {
      answers = (
        await pool.query(
          'SELECT response_id, question_id, option_id, text_value, scale_value FROM answers WHERE response_id = ANY($1)',
          [respIds]
        )
      ).rows;
    }
    // Agrupa respostas por (response_id, question_id)
    const porResposta = {};
    for (const a of answers) {
      const k = `${a.response_id}:${a.question_id}`;
      let valor = '';
      if (a.option_id != null) valor = textoOpcao[a.option_id] || '';
      else if (a.text_value != null) valor = a.text_value;
      else if (a.scale_value != null) valor = String(a.scale_value);
      if (!porResposta[k]) porResposta[k] = [];
      if (valor !== '') porResposta[k].push(valor);
    }

    const header = ['Data/Hora', ...questions.map((q) => q.text)];
    const linhas = [header.map(csvCell).join(',')];
    for (const r of responses) {
      const cols = [new Date(r.created_at).toISOString()];
      for (const q of questions) {
        const vals = porResposta[`${r.id}:${q.id}`] || [];
        cols.push(vals.join('; ')); // multipla escolha vira "A; B"
      }
      linhas.push(cols.map(csvCell).join(','));
    }

    const csv = '\uFEFF' + linhas.join('\r\n'); // BOM p/ acentos no Excel
    const nomeArquivo = `pesquisa-${s.slug}-resultados.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.send(csv);
  } catch (e) {
    console.error('[admin] csv:', e.message);
    res.status(500).json({ error: 'Erro ao gerar o CSV.' });
  }
});

module.exports = router;
