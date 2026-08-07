const { getPool, ok, fail, authSession } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return fail('Método no permitido.', 405);
  }

  const user = authSession(event);
  if (!user) {
    return fail('No autorizado. Inicia sesión.', 401);
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [user.id]
    );
    if (result.rows.length === 0) {
      return fail('Sesión no válida.', 401);
    }
    return ok({ ok: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error obteniendo sesión:', error);
    return fail('Error al obtener la sesión.', 500);
  }
};
