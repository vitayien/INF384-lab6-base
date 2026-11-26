const request = require('supertest');
const app = require('../src/app');

// Helper: verifica que un curso tenga los campos requeridos (1.1)
// cycle puede ser un entero o null (cursos electivos sin ciclo fijo)
function tieneCamposRequeridos(curso) {
  return (
    typeof curso.id === 'string' &&
    typeof curso.name === 'string' &&
    typeof curso.credits === 'number' &&
    (typeof curso.cycle === 'number' || curso.cycle === null) &&
    typeof curso.type === 'string'
  );
}

// ── Requisito 1.1 ───────────────────────────────────────────────────────────
describe('GET /cursos – todos los cursos (Req 1.1)', () => {
  test('responde 200 con un arreglo', async () => {
    const res = await request(app).get('/cursos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('devuelve los 87 cursos', async () => {
    const res = await request(app).get('/cursos');
    expect(res.body.length).toBe(87);
  });

  test('cada curso tiene id, name, credits, cycle y type', async () => {
    const res = await request(app).get('/cursos');
    expect(res.body.every(tieneCamposRequeridos)).toBe(true);
  });
});

// ── Requisito 1.2 ───────────────────────────────────────────────────────────
describe('GET /cursos?ciclo=N – filtro por ciclo (Req 1.2)', () => {
  test('ciclo=5 responde 200 con arreglo no vacío', async () => {
    const res = await request(app).get('/cursos?ciclo=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('todos los cursos devueltos corresponden al ciclo pedido', async () => {
    const res = await request(app).get('/cursos?ciclo=7');
    expect(res.body.every((c) => c.cycle === 7)).toBe(true);
  });

  test('ciclo=10 (límite superior) devuelve solo cursos de ciclo 10', async () => {
    const res = await request(app).get('/cursos?ciclo=10');
    expect(res.status).toBe(200);
    expect(res.body.every((c) => c.cycle === 10)).toBe(true);
  });
});

// ── Requisito 1.3 ───────────────────────────────────────────────────────────
describe('GET /cursos?ciclo=N – ciclo inválido (Req 1.3)', () => {
  const casosInvalidos = [
    { caso: 'ciclo fuera de rango (4)', query: '4' },
    { caso: 'ciclo fuera de rango (11)', query: '11' },
    { caso: 'ciclo no numérico', query: 'abc' },
    { caso: 'ciclo decimal', query: '6.5' },
  ];

  for (const { caso, query } of casosInvalidos) {
    test(`${caso} → 400 con mensaje de error`, async () => {
      const res = await request(app).get(`/cursos?ciclo=${query}`);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
    });
  }
});

// ── Requisito 2.1 ───────────────────────────────────────────────────────────
describe('GET /cursos/:codigo – curso existente (Req 2.1)', () => {
  test('responde 200 con el detalle del curso', async () => {
    const res = await request(app).get('/cursos/1INF30');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('1INF30');
    expect(res.body.name).toBe('Programación 3');
    expect(typeof res.body.credits).toBe('number');
    expect(typeof res.body.cycle).toBe('number');
    expect(typeof res.body.type).toBe('string');
  });

  test('incluye prerequisites como arreglo de objetos con id y name', async () => {
    const res = await request(app).get('/cursos/1INF30');
    expect(Array.isArray(res.body.prerequisites)).toBe(true);
    expect(res.body.prerequisites.length).toBeGreaterThan(0);
    for (const prereq of res.body.prerequisites) {
      expect(typeof prereq.id).toBe('string');
      expect(typeof prereq.name).toBe('string');
    }
  });

  test('resuelve correctamente el nombre del requisito de 1INF30', async () => {
    const res = await request(app).get('/cursos/1INF30');
    expect(res.body.prerequisites).toEqual(
      expect.arrayContaining([{ id: '1INF25', name: 'Programación 2' }])
    );
  });

  test('devuelve prerequisites vacío para un curso sin requisitos', async () => {
    const res = await request(app).get('/cursos/1INF25');
    expect(res.status).toBe(200);
    expect(res.body.prerequisites).toEqual([]);
  });
});

// ── Requisito 2.2 ───────────────────────────────────────────────────────────
describe('GET /cursos/:codigo – código inexistente (Req 2.2)', () => {
  test('responde 404 con mensaje de error', async () => {
    const res = await request(app).get('/cursos/XXX999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'curso no encontrado' });
  });
});

// ── Requisito 3.1 – Middleware de errores ───────────────────────────────────
describe('Middleware de errores (Req 3.1)', () => {
  // Montamos una app con una ruta que lanza un error, antes del middleware,
  // para disparar el manejador real de la aplicación.
  const express = require('express');
  const manejadorErrores = require('../src/middleware/errores');
  const appError = express();
  appError.get('/test-error', (req, res, next) => {
    next(new Error('error de prueba'));
  });
  appError.use(manejadorErrores);

  test('responde 500 con mensaje genérico ante un error no controlado', async () => {
    const res = await request(appError).get('/test-error');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'error interno del servidor' });
  });
});
