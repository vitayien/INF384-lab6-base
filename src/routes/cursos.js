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

module.exports = router;
