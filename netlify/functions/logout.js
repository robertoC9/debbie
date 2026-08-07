const { ok, fail } = require('./_shared');

// Con JWT en header, el logout es puramente cliente: el cliente elimina el token.
// Esta función existe por compatibilidad y devuelve confirmación.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return fail('Método no permitido.', 405);
  }
  return ok({ ok: true, message: 'Sesión cerrada.' });
};
