// src/index.js
// Ponto de entrada do backend. Nesta etapa ele:
//  - carrega as variáveis de ambiente
//  - inicializa o banco (cria schema + tabelas)
//  - sobe um endpoint /api/health pra você confirmar que tudo conectou
// As rotas do sistema (admin, pesquisas, respostas, resultados) vêm na próxima etapa.

require('dotenv').config();
const express = require('express');
const { pool, init, SCHEMA } = require('./db');

const PORT = process.env.PORT || 8080;

if (!process.env.DATABASE_URL) {
  console.warn(
    '[server] AVISO: DATABASE_URL não está definida. ' +
      'O backend não vai conseguir conectar no banco. ' +
      'Configure essa variável no EasyPanel (Internal Connection URL do Postgres).'
  );
}

const app = express();
app.use(express.json());
app.set('trust proxy', 1); // atrás do proxy (Traefik) do EasyPanel — IP real do cliente

// Health check: confirma que a API está no ar e que o banco responde.
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

async function start() {
  try {
    await init();
  } catch (err) {
    // Não derruba o processo: sobe mesmo assim pra /api/health mostrar o erro real.
    console.error('[server] falha ao inicializar o banco:', err.message);
  }
  app.listen(PORT, () => console.log(`[server] rodando na porta ${PORT}`));
}

start();
