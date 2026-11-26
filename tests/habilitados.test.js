const request = require('supertest');
const app = require('../src/app');

// Helper: genera un array de N códigos válidos de 6 chars alfanuméricos
function generarCodigos(n) {
  return Array.from({ length: n }, (_, i) => {
    const num = String(i).padStart(4, '0');
    return `AA${num}`;  // 'AA' + 4 dígitos = 6 chars
  });
}

// ── Subtarea 5.1 — Pruebas del caso feliz ────────────────────────────────────

describe('POST /habilitados – caso feliz (5.1)', () => {
  // AC-3: conjunto de referencia → exactamente 27 cursos
  test('["1INF25","1INF27","1INF49"] → 200 con exactamente 27 cursos', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: ['1INF25', '1INF27', '1INF49'] });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(27);
  });

  // AC-3: los cursos 1INF29, 1INF30, 1INF31, 1INF32 están en la respuesta
  test('respuesta con ["1INF25","1INF27","1INF49"] incluye 1INF29, 1INF30, 1INF31, 1INF32', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: ['1INF25', '1INF27', '1INF49'] });

    const ids = res.body.map((c) => c.id);
    expect(ids).toContain('1INF29');
    expect(ids).toContain('1INF30');
    expect(ids).toContain('1INF31');
    expect(ids).toContain('1INF32');
  });

  // AC-4: array vacío → solo cursos sin prerequisitos
  test('[] → 200, solo cursos con prerequisites: []', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: [] });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every((c) => c.prerequisites.length === 0)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  // AC-2: prereq faltante → curso excluido
  test('["1INF25"] sin 1INF27 → 1INF32 NO aparece en la respuesta', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: ['1INF25'] });

    expect(res.status).toBe(200);
    const ids = res.body.map((c) => c.id);
    expect(ids).not.toContain('1INF32');
  });

  // AC-10: código válido desconocido → 200, no 400 ni 500
  test('["ZZZZ99"] (código válido pero desconocido) → 200', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: ['ZZZZ99'] });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── Subtarea 5.2 — Formato de la respuesta ───────────────────────────────────

describe('POST /habilitados – formato de respuesta (5.2)', () => {
  let res;

  beforeAll(async () => {
    res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: ['1INF25', '1INF27', '1INF49'] });
  });

  // AC-11: cada objeto tiene los campos requeridos con los tipos correctos
  test('cada objeto tiene id (string), name (string), credits (number), cycle, type (string), prerequisites (array de strings)', () => {
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    for (const curso of res.body) {
      expect(typeof curso.id).toBe('string');
      expect(typeof curso.name).toBe('string');
      expect(typeof curso.credits).toBe('number');
      // cycle puede ser entero 5-10 o null para electivos
      expect(typeof curso.cycle === 'number' || curso.cycle === null).toBe(true);
      expect(typeof curso.type).toBe('string');
      expect(Array.isArray(curso.prerequisites)).toBe(true);
      // cada prerequisito es string
      expect(curso.prerequisites.every((p) => typeof p === 'string')).toBe(true);
    }
  });

  // AC-12: Content-Type de respuesta es application/json
  test('encabezado Content-Type de respuesta es application/json', () => {
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ── Subtarea 5.3 — Validación de entrada (un test por caso) ─────────────────

describe('POST /habilitados – validación de entrada (5.3)', () => {
  // AC-5: Content-Type incorrecto → 400
  test('Content-Type: text/plain → 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'text/plain')
      .send('{"aprobados":[]}');

    expect(res.status).toBe(400);
  });

  // AC-5: body JSON no parseable con Content-Type correcto → 400, no 500
  test('body no parseable como JSON → 400, no 500', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send('esto-no-es-json{{{');

    expect(res.status).toBe(400);
  });

  // AC-6: sin clave aprobados → 400
  test('{} sin clave aprobados → 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(400);
  });

  // AC-7: aprobados como string → 400
  test('aprobados como string → 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: '1INF25' });

    expect(res.status).toBe(400);
  });

  // AC-7: aprobados como número → 400
  test('aprobados como número → 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: 42 });

    expect(res.status).toBe(400);
  });

  // AC-7: aprobados como objeto → 400
  test('aprobados como objeto → 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: { codigo: '1INF25' } });

    expect(res.status).toBe(400);
  });

  // AC-8: exactamente 100 elementos válidos → 200
  test('exactamente 100 elementos válidos → 200', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: generarCodigos(100) });

    expect(res.status).toBe(200);
  });

  // AC-8: 101 elementos válidos → 400
  test('101 elementos válidos → 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: generarCodigos(101) });

    expect(res.status).toBe(400);
  });

  // AC-9: código con 5 caracteres → 400
  test('código con 5 caracteres → 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: ['1INF2'] });

    expect(res.status).toBe(400);
  });

  // AC-9: código con 7 caracteres → 400
  test('código con 7 caracteres → 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: ['1INF250'] });

    expect(res.status).toBe(400);
  });

  // AC-9: código con carácter especial → 400
  test('código con carácter especial "1INF30<script>" → 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send({ aprobados: ['1INF30<script>'] });

    expect(res.status).toBe(400);
  });
});

// ── Subtarea 5.4 — Sin internos en los cuerpos de error ──────────────────────

describe('POST /habilitados – sin internos en errores (5.4)', () => {
  const casosError = [
    {
      desc: 'Content-Type: text/plain',
      fn: () =>
        request(app)
          .post('/habilitados')
          .set('Content-Type', 'text/plain')
          .send('{"aprobados":[]}'),
    },
    {
      desc: 'body JSON no parseable',
      fn: () =>
        request(app)
          .post('/habilitados')
          .set('Content-Type', 'application/json')
          .send('esto-no-es-json{{{'),
    },
    {
      desc: 'sin clave aprobados',
      fn: () =>
        request(app)
          .post('/habilitados')
          .set('Content-Type', 'application/json')
          .send({}),
    },
    {
      desc: 'código con carácter especial',
      fn: () =>
        request(app)
          .post('/habilitados')
          .set('Content-Type', 'application/json')
          .send({ aprobados: ['1INF30<script>'] }),
    },
  ];

  for (const { desc, fn } of casosError) {
    test(`${desc}: el body de error no contiene stack trace ni rutas de archivos`, async () => {
      const res = await fn();

      // El body debe tener solo la clave "error"
      expect(res.body).toHaveProperty('error');
      const errorMsg = res.body.error;

      // Sin stack traces (no empieza con "Error:" ni contiene "at ")
      expect(errorMsg).not.toMatch(/^\s*Error:/);
      expect(errorMsg).not.toMatch(/\bat\b.*\(.*\.js/);

      // Sin rutas de archivos del sistema (separadores de ruta típicos)
      expect(errorMsg).not.toMatch(/[/\\](src|node_modules|dist)[/\\]/);

      // Sin el código malicioso reflejado textualmente
      expect(errorMsg).not.toContain('<script>');
    });
  }
});
