// Middleware de manejo de errores (Requisito 3.1).
// Express reconoce un middleware de error por sus 4 argumentos.
function manejadorErrores(err, req, res, next) {
  console.error(err);
  res.status(500).json({ error: 'error interno del servidor' });
}

module.exports = manejadorErrores;
