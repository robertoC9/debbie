// Helper compartido para las Netlify Functions.
// Centraliza la conexión a PostgreSQL, auth JWT (header Authorization),
// validaciones (email, honeypot), rate limiting y utilidades de respuesta.

const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dns = require('dns');
const bcrypt = require('bcryptjs');

// Pool global reutilizado entre invocaciones (caliente en producción)
let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

// JWT_SECRET estable: si falta en producción, generamos uno estable por sesión.
// IMPORTANTE: en Netlify debe configurarse JWT_SECRET como variable de entorno.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// ========== Utilidades de respuesta ==========
function ok(data, statusCode) {
  return {
    statusCode: statusCode || 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': true },
    body: JSON.stringify(data)
  };
}

function fail(message, statusCode) {
  return {
    statusCode: statusCode || 400,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': true },
    body: JSON.stringify({ ok: false, message: message })
  };
}

// ========== JWT ==========
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function parseToken(event) {
  const authHeader = (event.headers && event.headers.authorization) || '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

function authSession(event) {
  const token = parseToken(event);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// ========== Rate limiting básico (por IP) ==========
const attempts = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const RATE_MAX = 5;

function getClientIp(event) {
  return (
    (event.headers && event.headers['x-nf-client-connection-ip']) ||
    (event.headers && event.headers['x-forwarded-for']) ||
    'unknown'
  );
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.resetAt > now && entry.count >= RATE_MAX) {
    return true;
  }
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 0, resetAt: now + RATE_WINDOW_MS });
  }
  return false;
}

function recordFailure(ip) {
  if (!ip) return;
  const entry = attempts.get(ip);
  if (entry) {
    entry.count += 1;
  } else {
    attempts.set(ip, { count: 1, resetAt: Date.now() + RATE_WINDOW_MS });
  }
}

function recordSuccess(ip) {
  if (!ip) return;
  attempts.delete(ip);
}

// ========== Validación de email ==========
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'temp-mail.org', 'guerrillamail.com',
  'yopmail.com', 'maildrop.cc', '10minutemail.com', 'sharklasers.com',
  'trashmail.com', 'getnada.com', 'throwawaymail.com', 'mailnesia.com'
]);

function isValidEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return false;
  const domain = email.split('@')[1].toLowerCase();
  return !DISPOSABLE_DOMAINS.has(domain);
}

function verifyEmailDeliverable(email) {
  return new Promise((resolve) => {
    const domain = email.split('@')[1];
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        return resolve(false);
      }
      resolve(true);
    });
  });
}

module.exports = {
  getPool,
  JWT_SECRET,
  ok,
  fail,
  signToken,
  authSession,
  isRateLimited,
  recordFailure,
  recordSuccess,
  getClientIp,
  isValidEmail,
  verifyEmailDeliverable,
  bcrypt
};
