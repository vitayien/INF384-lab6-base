// Middleware de manejo de errores (Requisito 3.1).
// Express reconoce un middleware de error por sus 4 argumentos.
function manejadorErrores(err, req, res, next) {
  // Guarda para errores de parseo JSON (Requisito de habilitados: cuerpo inválido).
  if (err.status === 400 || err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'cuerpo de solicitud inválido o Content-Type incorrecto' });
  }
  console.error(err);
  res.status(500).json({ error: 'error interno del servidor' });
}

module.exports = manejadorErrores;
