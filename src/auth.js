// src/auth.js
// Autenticação do admin único. A senha vem da variável ADMIN_PASSWORD.
// Ao logar, emitimos um JWT (assinado com JWT_SECRET) que o frontend pode
// guardar e mandar como cookie OU como header Authorization: Bearer.

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'troque-este-segredo-em-producao';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
const TOKEN_COOKIE = 'admin_token';

function signAdminToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
}

// Comparação de senha resistente a ataque de timing.
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Opções padrão do cookie de sessão do admin.
function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE, // 'lax' mesmo domínio; 'none' (com secure) p/ cross-site
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    path: '/',
  };
}

// Middleware: exige um token de admin válido (via cookie ou Bearer).
function requireAdmin(req, res, next) {
  const fromCookie = req.cookies ? req.cookies[TOKEN_COOKIE] : null;
  const auth = req.headers.authorization || '';
  const fromBearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const token = fromCookie || fromBearer;

  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('role inválida');
    req.admin = true;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

module.exports = {
  signAdminToken,
  safeEqual,
  requireAdmin,
  adminCookieOptions,
  TOKEN_COOKIE,
};
