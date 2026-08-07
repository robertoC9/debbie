const { getPool, ok, fail, authSession } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST' }, body: '' };
  }

  const user = authSession(event);
  if (!user) {
    return fail('No autorizado. Inicia sesión.', 401);
  }

  const pool = getPool();
  const method = event.httpMethod;

  try {
    if (method === 'GET') {
      const result = await pool.query(
        'SELECT id, content, created_at FROM messages WHERE user_id = $1 ORDER BY created_at ASC',
        [user.id]
      );
      return ok({ ok: true, data: result.rows });
    }

    if (method === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (err) {
        return fail('Solicitud inválida.', 400);
      }
      const { content } = body;
      if (typeof content !== 'string' || !content.trim()) {
        return fail('El mensaje no puede estar vacío.', 400);
      }
      if (content.trim().length > 1000) {
        return fail('El mensaje no puede superar los 1000 caracteres.', 400);
      }
      const result = await pool.query(
        'INSERT INTO messages (user_id, content) VALUES ($1, $2) RETURNING id, content, created_at',
        [user.id, content.trim()]
      );
      return ok({ ok: true, message: 'Mensaje guardado.', data: result.rows[0] });
    }

    return fail('Método no permitido.', 405);
  } catch (error) {
    console.error('Error en messages:', error);
    return fail('Error al procesar mensajes.', 500);
  }
};
