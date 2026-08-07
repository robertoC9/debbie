const {
  getPool, ok, fail, signToken, isRateLimited, recordFailure, recordSuccess,
  getClientIp, isValidEmail, verifyEmailDeliverable, bcrypt
} = require('./_shared');

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return fail('Método no permitido.', 405);
  }

  const ip = getClientIp(event);
  if (isRateLimited(ip)) {
    return fail('Demasiados intentos. Espere unos minutos.', 429);
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return fail('Solicitud inválida.', 400);
  }

  const { name, email, password, website } = body;

  // Honeypot anti-bots
  if (website && website.trim() !== '') {
    recordFailure(ip);
    return fail('Solicitud inválida.', 400);
  }

  if (!name || !email || !password) {
    return fail('Nombre, correo y contraseña son obligatorios.', 400);
  }
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return fail('Datos inválidos.', 400);
  }
  if (!name.trim() || name.trim().length < 2) {
    return fail('Escribe un nombre válido (mín. 2 caracteres).', 400);
  }
  if (name.length > 50) {
    return fail('El nombre no puede superar los 50 caracteres.', 400);
  }
  if (!isValidEmail(email)) {
    return fail('Correo inválido o de un dominio temporal.', 400);
  }
  if (password.length < 6) {
    return fail('La contraseña debe tener al menos 6 caracteres.', 400);
  }
  if (password.length > 72) {
    return fail('La contraseña no puede superar los 72 caracteres.', 400);
  }

  try {
    const pool = getPool();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      recordFailure(ip);
      return fail('Ese correo ya está registrado.', 409);
    }

    const emailReal = await verifyEmailDeliverable(email);
    if (!emailReal) {
      recordFailure(ip);
      return fail('El correo no es válido o no existe.', 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, email_verified) VALUES ($1, $2, $3, true) RETURNING id, name, email',
      [name.trim(), email.toLowerCase(), passwordHash]
    );
    const user = result.rows[0];

    const token = signToken(user);
    recordSuccess(ip);
    return ok({
      ok: true,
      message: 'Cuenta creada. Bienvenido al club Debbie.',
      token: token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    recordFailure(ip);
    return fail('No se pudo completar el registro. Inténtalo de nuevo.', 500);
  }
};
