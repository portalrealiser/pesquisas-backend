// src/index.js
// Ponto de entrada do backend: inicializa o banco e sobe a API com todas as rotas.

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const { pool, init, SCHEMA } = require('./db');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.warn(
    '[server] AVISO: DATABASE_URL não está definida. Configure no EasyPanel ' +
      '(Internal Connection URL do Postgres).'
  );
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.set('trust proxy', 1); // atrás do proxy (Traefik) do EasyPanel — IP real do cliente

// CORS: liberado só para as origens listadas em FRONTEND_ORIGIN (separadas por vírgula).
// Necessário quando o frontend rodar em outro domínio (ex.: Vercel) e usar cookies.
const ORIGENS = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ORIGENS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT now() AS agora, current_schema() AS schema');
    res.json({
      ok: true,
      db: 'conectado',
      schema_ativo: rows[0].schema,
      schema_esperado: SCHEMA,
      hora_do_banco: rows[0].agora,
    });
  } catch (err) {
    res.status(500).json({ ok: false, db: 'erro', erro: err.message });
  }
});

// Rotas
app.use('/api/admin', adminRoutes);
app.use('/api/p', publicRoutes);

// Servir o frontend (build do React) no mesmo domínio.
// Em produção, o Dockerfile copia o build pra ./public.
const FRONTEND_DIR = path.join(__dirname, '..', 'public');
if (fs.existsSync(path.join(FRONTEND_DIR, 'index.html'))) {
  app.use(express.static(FRONTEND_DIR));
  // SPA fallback: qualquer caminho que NÃO seja /api devolve o index.html,
  // pra o React Router cuidar das rotas no navegador.
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  });
}

// Erro de JSON malformado
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
  }
  console.error('[server] erro não tratado:', err.message);
  res.status(500).json({ error: 'Erro interno.' });
});

async function start() {
  try {
    await init();
  } catch (err) {
    console.error('[server] falha ao inicializar o banco:', err.message);
  }
  app.listen(PORT, () => console.log(`[server] rodando na porta ${PORT}`));
}

start();
