const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dns = require('dns');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// Pool de conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Verificar conexión a la base de datos
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error conectando a PostgreSQL:', err.message);
  } else {
    console.log('Conectado a PostgreSQL ✔');
    release();
  }
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Servir el frontend desde la carpeta frontend/
const FRONTEND_DIR = path.join(__dirname, 'frontend');
app.use(express.static(FRONTEND_DIR));

// Constantes de la sesión mediante cookie httpOnly
const COOKIE_NAME = 'debbie_session';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 días

// Helper para crear el token JWT y guardarlo en una cookie httpOnly
function setSessionCookie(res, userId, email) {
  const token = jwt.sign({ id: userId, email: email }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE
  });
  return token;
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });
}

// Middleware que autentica con la cookie de sesión (httpOnly) o el header Bearer
function authSession(req, res, next) {
  let token = req.cookies && req.cookies[COOKIE_NAME];
  const authHeader = req.headers['authorization'];
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ ok: false, message: 'No autorizado. Inicia sesión.' });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ ok: false, message: 'Sesión inválida o expirada.' });
    }
    req.user = user;
    next();
  });
}

// ========== RATE LIMITING BÁSICO (por IP) ==========
const attempts = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const RATE_MAX = 5;

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = attempts.get(ip);

  if (entry && entry.resetAt > now && entry.count >= RATE_MAX) {
    const minsLeft = Math.ceil((entry.resetAt - now) / 60000);
    return res.status(429).json({
      ok: false,
      message: 'Demasiados intentos. Espera ' + minsLeft + ' min para volver a intentarlo.'
    });
  }

  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 0, resetAt: now + RATE_WINDOW_MS });
  }
  res.locals._ip = ip;
  next();
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

// Dominios de correo desechables bloqueados
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

// Verifica que el dominio del correo tenga registros MX
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

// ========== REGISTRO DE USUARIO (sin confirmación por correo) ==========
app.post('/api/register', rateLimit, async (req, res) => {
  const { name, email, password, website } = req.body;
  const ip = res.locals._ip;

  // Honeypot anti-bots
  if (website && website.trim() !== '') {
    recordFailure(ip);
    return res.status(400).json({ ok: false, message: 'Solicitud inválida.' });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, message: 'Nombre, correo y contraseña son obligatorios.' });
  }
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, message: 'Datos inválidos.' });
  }
  if (!name.trim() || name.trim().length < 2) {
    return res.status(400).json({ ok: false, message: 'Escribe un nombre válido (mín. 2 caracteres).' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, message: 'Correo inválido o de un dominio temporal.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      recordFailure(ip);
      return res.status(409).json({ ok: false, message: 'Ese correo ya está registrado.' });
    }

    const emailReal = await verifyEmailDeliverable(email);
    if (!emailReal) {
      recordFailure(ip);
      return res.status(400).json({ ok: false, message: 'El correo no es válido o no existe.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Insertar usuario directamente (verificado por defecto, sin correo)
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, email_verified) VALUES ($1, $2, $3, true) RETURNING id, name, email',
      [name.trim(), email.toLowerCase(), passwordHash]
    );
    const user = result.rows[0];

    // Iniciar sesión automáticamente
    const token = setSessionCookie(res, user.id, user.email);
    recordSuccess(ip);
    console.log('Nuevo usuario registrado: ' + user.email);
    res.json({
      ok: true,
      message: 'Cuenta creada. Bienvenido al club Debbie.',
      token: token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    recordFailure(ip);
    res.status(500).json({ ok: false, message: 'No se pudo completar el registro. Inténtalo de nuevo.' });
  }
});

// ========== RECUPERAR SESIÓN ==========
app.get('/api/me', authSession, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      clearSessionCookie(res);
      return res.status(401).json({ ok: false, message: 'Sesión no válida.' });
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error obteniendo sesión:', error);
    res.status(500).json({ ok: false, message: 'Error al obtener la sesión.' });
  }
});

// ========== LOGOUT ==========
app.post('/api/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true, message: 'Sesión cerrada.' });
});

// ========== LOGIN DE USUARIO (sin verificación de correo) ==========
app.post('/api/login', rateLimit, async (req, res) => {
  const { email, password } = req.body;
  const ip = res.locals._ip;

  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'Correo y contraseña son obligatorios.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [String(email).toLowerCase()]
    );

    if (result.rows.length === 0) {
      recordFailure(ip);
      return res.status(401).json({ ok: false, message: 'Correo o contraseña incorrectos.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      recordFailure(ip);
      return res.status(401).json({ ok: false, message: 'Correo o contraseña incorrectos.' });
    }

    const token = setSessionCookie(res, user.id, user.email);
    recordSuccess(ip);
    res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Error en login:', error);
    recordFailure(ip);
    res.status(500).json({ ok: false, message: 'Error al iniciar sesión.' });
  }
});

// ========== GUARDAR MENSAJE ==========
app.post('/api/messages', authSession, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ ok: false, message: 'El mensaje no puede estar vacío.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO messages (user_id, content) VALUES ($1, $2) RETURNING id, content, created_at',
      [req.user.id, content.trim()]
    );
    res.json({ ok: true, message: 'Mensaje guardado.', data: result.rows[0] });
  } catch (error) {
    console.error('Error guardando mensaje:', error);
    res.status(500).json({ ok: false, message: 'No se pudo guardar el mensaje.' });
  }
});

// ========== RECUPERAR MENSAJES DEL USUARIO ==========
app.get('/api/messages', authSession, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, content, created_at FROM messages WHERE user_id = $1 ORDER BY created_at ASC',
      [req.user.id]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ ok: false, message: 'No se pudieron obtener los mensajes.' });
  }
});

// ========== FALLBACK SPA: cualquier GET que no sea /api devuelve index.html ==========
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log('Servidor corriendo en http://localhost:' + PORT);
});

