const express = require('express');
const repositorio = require('../data/repositorio');

const router = express.Router();

/**
 * GET /cursos
 * Query param opcional: ciclo (entero entre 5 y 10)
 *
 * Requisitos: 1.1, 1.2, 1.3
 */
router.get('/', (req, res) => {
  const { ciclo } = req.query;

  if (ciclo !== undefined) {
    const cicloNum = Number(ciclo);

    // 1.3: ciclo inválido → 400
    if (!Number.isInteger(cicloNum) || cicloNum < 5 || cicloNum > 10) {
      return res.status(400).json({ error: 'ciclo debe ser un entero entre 5 y 10' });
    }

    // 1.2: filtrar por ciclo
    return res.json(repositorio.listarPorCiclo(cicloNum));
  }

  // 1.1: devolver todos los cursos
  res.json(repositorio.listar());
});

/**
 * GET /cursos/:codigo
 * Devuelve el detalle de un curso con sus requisitos resueltos (id + nombre).
 *
 * Requisitos: 2.1, 2.2
 */
router.get('/:codigo', (req, res) => {
  const { codigo } = req.params;
  const curso = repositorio.obtener(codigo);

  // 2.2: código inexistente → 404
  if (!curso) {
    return res.status(404).json({ error: 'curso no encontrado' });
  }

  // 2.1: resolver el nombre de cada requisito
  const prerequisites = (curso.prerequisites || []).map((id) => {
    const req = repositorio.obtener(id);
    return { id, name: req ? req.name : id };
  });

  res.json({
    id: curso.id,
    name: curso.name,
    credits: curso.credits,
    cycle: curso.cycle,
    type: curso.type,
    prerequisites,
  });
});

module.exports = router;
