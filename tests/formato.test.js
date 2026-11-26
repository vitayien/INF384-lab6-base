const {
  formatearNombre,
  formatearCreditos,
  formatearCiclo,
  formatearTipo,
  resumenCurso,
  totalCreditos,
  agruparPorCiclo,
  ordenarPorCreditos,
  listaRequisitos,
} = require('../src/util/formato');

describe('formatearNombre', () => {
  test('capitaliza cada palabra', () => {
    expect(formatearNombre('sistemas operativos')).toBe('Sistemas Operativos');
  });

  test('convierte todo a minúsculas antes de capitalizar', () => {
    expect(formatearNombre('CÁLCULO DIFERENCIAL')).toBe('Cálculo Diferencial');
  });
});

describe('formatearCreditos', () => {
  test('formatea con un decimal y la palabra créditos', () => {
    expect(formatearCreditos(3)).toBe('3.0 créditos');
  });

  test('formatea con un decimal cuando ya tiene decimales', () => {
    expect(formatearCreditos(3.5)).toBe('3.5 créditos');
  });
});

describe('formatearCiclo', () => {
  test('devuelve "Electivo" para null', () => {
    expect(formatearCiclo(null)).toBe('Electivo');
  });

  test('devuelve "Electivo" para undefined', () => {
    expect(formatearCiclo(undefined)).toBe('Electivo');
  });

  test('devuelve "Ciclo N" para un número', () => {
    expect(formatearCiclo(5)).toBe('Ciclo 5');
  });
});

describe('formatearTipo', () => {
  test('devuelve "Obligatorio" para tipo obligatorio', () => {
    expect(formatearTipo('obligatorio')).toBe('Obligatorio');
  });

  test('devuelve "Electivo" para cualquier otro tipo', () => {
    expect(formatearTipo('electivo')).toBe('Electivo');
  });
});

describe('resumenCurso', () => {
  test('combina id, name y créditos formateados', () => {
    const curso = { id: '1INF25', name: 'Programación', credits: 4 };
    expect(resumenCurso(curso)).toBe('1INF25 · Programación · 4.0 créditos');
  });
});

describe('totalCreditos', () => {
  test('suma los créditos de todos los cursos', () => {
    const cursos = [{ credits: 3 }, { credits: 4.5 }, { credits: 2.5 }];
    expect(totalCreditos(cursos)).toBe(10);
  });

  test('devuelve 0 para un array vacío', () => {
    expect(totalCreditos([])).toBe(0);
  });
});

describe('agruparPorCiclo', () => {
  test('agrupa cursos por ciclo formateado', () => {
    const cursos = [
      { id: 'B', cycle: 5, name: 'B' },
      { id: 'A', cycle: 5, name: 'A' },
      { id: 'C', cycle: null, name: 'C' },
    ];
    const grupos = agruparPorCiclo(cursos);
    expect(grupos['Ciclo 5']).toHaveLength(2);
    // Ordenados por id
    expect(grupos['Ciclo 5'][0].id).toBe('A');
    expect(grupos['Electivo']).toHaveLength(1);
  });
});

describe('ordenarPorCreditos', () => {
  test('ordena por créditos descendente y luego por id ascendente', () => {
    const cursos = [
      { id: 'B', credits: 3 },
      { id: 'A', credits: 4 },
      { id: 'C', credits: 3 },
    ];
    const ordenados = ordenarPorCreditos(cursos);
    expect(ordenados[0].id).toBe('A');   // mayor crédito
    expect(ordenados[1].id).toBe('B');   // mismos créditos, B < C
    expect(ordenados[2].id).toBe('C');
  });
});

describe('listaRequisitos', () => {
  test('devuelve "Sin requisitos" para array vacío', () => {
    expect(listaRequisitos([])).toBe('Sin requisitos');
  });

  test('devuelve los códigos ordenados y separados por coma', () => {
    expect(listaRequisitos(['1INF27', '1INF25'])).toBe('1INF25, 1INF27');
  });
});
