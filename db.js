// src/db.js
// Conexão com o Postgres + criação do schema dedicado e das tabelas.
//
// Desenho pensado pra compartilhar o banco "memoria" com outros sistemas no futuro:
// tudo deste projeto vive dentro de um SCHEMA próprio (padrão: "pesquisas"),
// isolado do schema "public". Outro app futuro ganha o próprio schema e os dois
// nunca colidem.

const { Pool } = require('pg');

// Nome do schema deste sistema (configurável via env, com validação anti-injeção).
const SCHEMA = (process.env.DB_SCHEMA || 'pesquisas').trim();
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(SCHEMA)) {
  throw new Error(`DB_SCHEMA inválido: "${SCHEMA}". Use apenas letras, números e underscore.`);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Toda conexão já nasce com o search_path no nosso schema (definido no nível
  // do protocolo, sem query extra). Assim as queries das rotas podem ser escritas
  // sem prefixo de schema.
  options: `-c search_path=${SCHEMA},public`,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[db] erro inesperado no pool:', err.message);
});

// DDL idempotente: roda no boot, cria o que faltar e não mexe no que já existe.
const DDL = `
CREATE SCHEMA IF NOT EXISTS ${SCHEMA};

-- Pesquisas (cada uma com seu link público /r/<slug>)
CREATE TABLE IF NOT EXISTS surveys (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'rascunho'
              CHECK (status IN ('rascunho', 'publicada', 'encerrada')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Perguntas (5 tipos: unica, multipla, texto_curto, texto_longo, escala)
CREATE TABLE IF NOT EXISTS questions (
  id         BIGSERIAL PRIMARY KEY,
  survey_id  BIGINT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  type       TEXT NOT NULL
             CHECK (type IN ('unica', 'multipla', 'texto_curto', 'texto_longo', 'escala')),
  text       TEXT NOT NULL,
  position   INT NOT NULL DEFAULT 0,
  required   BOOLEAN NOT NULL DEFAULT true,
  scale_min  INT,            -- só para type = 'escala'
  scale_max  INT             -- só para type = 'escala'
);

-- Opções (para perguntas 'unica' e 'multipla')
CREATE TABLE IF NOT EXISTS options (
  id          BIGSERIAL PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  position    INT NOT NULL DEFAULT 0
);

-- Respostas: uma submissão da pesquisa = uma linha.
-- Guarda os sinais de anti-duplicação (cookie, fingerprint, hash do IP — nunca o IP cru).
CREATE TABLE IF NOT EXISTS responses (
  id             BIGSERIAL PRIMARY KEY,
  survey_id      BIGINT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  visitor_cookie TEXT,
  fingerprint    TEXT,
  ip_hash        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens de resposta: uma linha por pergunta respondida.
-- option_id  -> escolha (unica) ou cada marcação (multipla, várias linhas)
-- text_value -> texto_curto / texto_longo
-- scale_value-> escala
CREATE TABLE IF NOT EXISTS answers (
  id          BIGSERIAL PRIMARY KEY,
  response_id BIGINT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_id   BIGINT REFERENCES options(id) ON DELETE CASCADE,
  text_value  TEXT,
  scale_value INT
);

-- Índices para a deduplicação (busca por sinal dentro de uma pesquisa) e agregações
CREATE INDEX IF NOT EXISTS idx_responses_survey  ON responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_cookie  ON responses(survey_id, visitor_cookie);
CREATE INDEX IF NOT EXISTS idx_responses_fp      ON responses(survey_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_responses_ip      ON responses(survey_id, ip_hash);
CREATE INDEX IF NOT EXISTS idx_questions_survey  ON questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_options_question  ON options(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_response  ON answers(response_id);
CREATE INDEX IF NOT EXISTS idx_answers_question  ON answers(question_id);
`;

// No primeiro boot o Postgres pode ainda não estar pronto — tentamos com backoff.
async function init() {
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query(DDL);
      console.log(`[db] schema "${SCHEMA}" e tabelas prontos.`);
      return;
    } catch (err) {
      console.error(`[db] tentativa ${attempt}/${maxAttempts} falhou: ${err.message}`);
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

module.exports = { pool, init, SCHEMA };
