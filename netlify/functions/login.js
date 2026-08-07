const {
  getPool, ok, fail, signToken, isRateLimited, recordFailure, recordSuccess, getClientIp, bcrypt
} = require('./_shared');

exports.handler = async (event) => {
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

  const { email, password } = body;
  if (!email || !password) {
    return fail('Correo y contraseña son obligatorios.', 400);
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [String(email).toLowerCase()]
    );

    if (result.rows.length === 0) {
      recordFailure(ip);
      return fail('Correo o contraseña incorrectos.', 401);
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      recordFailure(ip);
      return fail('Correo o contraseña incorrectos.', 401);
    }

    const token = signToken(user);
    recordSuccess(ip);
    return ok({
      ok: true,
      token: token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Error en login:', error);
    recordFailure(ip);
    return fail('Error al iniciar sesión.', 500);
  }
};
