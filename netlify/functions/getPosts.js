const { getPool, ok, fail } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return fail('Método no permitido.', 405);
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, title, content, excerpt, slug, created_at, updated_at
       FROM posts
       WHERE published = true
       ORDER BY created_at DESC`
    );

    return ok({ ok: true, data: result.rows });
  } catch (error) {
    console.error('Error en getPosts:', error);
    return fail('Error al obtener los posts.', 500);
  }
};
