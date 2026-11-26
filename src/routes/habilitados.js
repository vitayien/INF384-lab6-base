const express = require('express');
const repositorio = require('../data/repositorio');

const router = express.Router();

const PATRON_CODIGO = /^[A-Za-z0-9]{6}$/;
const MAX_APROBADOS = 100;

/**
 * calcularHabilitados(aprobados: string[]): object[]
 *
 * Retorna los cursos del repositorio para los cuales el alumno está habilitado.
 * Un curso está habilitado si:
 *   - su id NO está en aprobados, Y
 *   - todos sus prerequisitos están en aprobados (o no tiene prerequisitos).
 *
 * No muta los objetos del repositorio.
 */
function calcularHabilitados(aprobados) {
  const aprobadosSet = new Set(aprobados);
  return repositorio.listar().filter((curso) => {
    if (aprobadosSet.has(curso.id)) return false;
    return curso.prerequisites.every((prereqId) => aprobadosSet.has(prereqId));
  });
}

/**
 * POST /habilitados
 *
 * Body: { "aprobados": string[] }
 * Response 200: array de objetos curso habilitados (AC-1, AC-11, AC-12)
 * Response 400: { "error": "<mensaje>" } para entrada inválida (AC-5..AC-9)
 */
router.post('/', (req, res) => {
  // AC-5 (Content-Type): express.json() NO lanza error cuando el Content-Type
  // no es application/json; simplemente no parsea y req.body queda undefined.
  // Por eso la verificación del Content-Type debe ser EXPLÍCITA y ANTES de
  // acceder a req.body.
  if (req.is('application/json') !== 'application/json') {
    return res.status(400).json({ error: 'Content-Type debe ser application/json' });
  }

  // AC-5 (parseo): si el body llegara undefined con Content-Type correcto,
  // el error de parseo ya fue interceptado por errores.js → 400.
  // Verificación defensiva de que el body existe y es un objeto.
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'cuerpo de solicitud inválido' });
  }

  // AC-6: presencia de clave aprobados
  if (!Object.prototype.hasOwnProperty.call(req.body, 'aprobados')) {
    return res.status(400).json({ error: 'falta el campo aprobados' });
  }

  const { aprobados } = req.body;

  // AC-7: debe ser un array
  if (!Array.isArray(aprobados)) {
    return res.status(400).json({ error: 'aprobados debe ser un array' });
  }

  // AC-8: máximo 100 elementos
  if (aprobados.length > MAX_APROBADOS) {
    return res.status(400).json({ error: 'aprobados no puede superar 100 elementos' });
  }

  // AC-9: cada elemento debe coincidir con ^[A-Za-z0-9]{6}$
  for (const codigo of aprobados) {
    if (typeof codigo !== 'string' || !PATRON_CODIGO.test(codigo)) {
      return res.status(400).json({ error: 'cada código debe tener exactamente 6 caracteres alfanuméricos' });
    }
  }

  // AC-1, AC-2, AC-4, AC-10: calcular habilitados
  const habilitados = calcularHabilitados(aprobados);

  // AC-11, AC-12: retornar array con campos del repositorio
  res.json(habilitados);
});

module.exports = router;
