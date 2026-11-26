# Implementation Plan: habilitados

## Overview

Implementar el endpoint `POST /habilitados` en el servicio Express existente (Node.js/JavaScript, Jest + Supertest), siguiendo el patrón del recurso `/cursos`. La secuencia es: inspección de convenciones, ruta nueva con validaciones de entrada (AC-5 a AC-9), algoritmo de habilitación (AC-1 a AC-4, AC-10), integración con corrección mínima del middleware de errores (AC-5) y montaje en `src/app.js`, pruebas funcionales y de validación en `tests/habilitados.test.js`, y verificación de cobertura global ≥ 80 % (AC-13). Sin dependencias nuevas; el repositorio (`src/data/repositorio.js`) no se modifica. Los detalles de implementación viven en design.md; aquí solo el plan de tareas.

## Tasks

- [x] 1. Inspección de la estructura y convenciones del proyecto
  - [x] 1.1 Revisar `src/app.js` (montaje de rutas, `express.json()` global, orden del middleware de errores), `src/routes/cursos.js` (patrón de router y validaciones) y `src/data/repositorio.js` (API `listar()`/`obterner`)
    - Confirmar el punto de montaje de la ruta nueva: después de `/cursos` y antes del middleware de errores. Sin escribir código.
    - _Requisitos: base para AC-1 a AC-12_
  - [x] 1.2 Revisar `tests/cursos.test.js` y `jest.config.js` para adoptar el patrón de pruebas con supertest sobre `src/app`
    - _Requisitos: base para AC-13_

- [x] 2. Crear la ruta `POST /habilitados` con validaciones de entrada
  - [x] 2.1 Crear `src/routes/habilitados.js` con el router y el handler `POST /`
    - Definir constantes `PATRON_CODIGO = /^[A-Za-z0-9]{6}$/` y `MAX_APROBADOS = 100`.
    - _Requisitos: 2.1, 3.1, 4.1 (AC-5 a AC-9)_
  - [x] 2.2 Implementar la verificación explícita de Content-Type y del cuerpo (AC-5), la presencia de la clave `aprobados` (AC-6), y el tipo array (AC-7)
    - Nota: `express.json()` no lanza error con Content-Type incorrecto; `req.body` queda `undefined`.
    - _Requisitos: 2.1, 2.2, 2.3 (AC-5, AC-6, AC-7)_
  - [x] 2.3 Implementar el límite de 100 elementos (AC-8) y la validación del formato de cada código (AC-9)
    - Mensajes de error estáticos, sin reflejar el código inválido, sin stack traces ni rutas.
    - _Requisitos: 3.1, 4.1 (AC-8, AC-9)_

- [x] 3. Implementar el algoritmo de cálculo de cursos habilitados
  - [x] 3.1 Implementar `calcularHabilitados(aprobados)` como función privada en `src/routes/habilitados.js`, reutilizando `repositorio.listar()`
    - Basado en `Set`: incluir un curso si su `id` no está en `aprobados` y todos sus `prerequisites` están en `aprobados`; cursos sin prerequisitos se incluyen si no están aprobados; los códigos válidos inexistentes se tratan como aprobados sin tratamiento especial.
    - Sin mutar los objetos del repositorio.
    - _Requisitos: 1.1, 1.2, 1.4, 4.2 (AC-1, AC-2, AC-4, AC-10)_
  - [x] 3.2 Responder la lista filtrada con `res.json(habilitados)` (Content-Type `application/json` automático, campos según repositorio)
    - _Requisitos: 1.3, 5.1, 5.2 (AC-3, AC-11, AC-12)_
  - [x] 3.3 Verificar en `data/cursos.json` que `1INF32` tiene prerequisitos `["1INF25","1INF27"]` para calibrar los casos de AC-2/AC-3
    - _Requisitos: 1.2, 1.3 (AC-2, AC-3)_

- [x] 4. Integrar la ruta y el manejo de errores de parseo JSON
  - [x] 4.1 Preponer la guarda de errores de parseo JSON en `src/middleware/errores.js`
    - `if (err.status === 400 || err.type === 'entity.parse.failed')` → 400 con mensaje genérico; preservar `console.error` y el camino de 500 intactos.
    - _Requisitos: 2.1 (AC-5)_
  - [x] 4.2 Montar la ruta en `src/app.js`
    - `app.use('/habilitados', require('./routes/habilitados'));` después de `/cursos` y antes del middleware de errores. No modificar `express.json()`, `express.static` ni `/health`.
    - _Requisitos: habilita AC-1 a AC-12_

- [x] 5. Implementar pruebas funcionales y de validación en `tests/habilitados.test.js`
  - [x] 5.1 Crear el archivo de pruebas con supertest sobre `src/app` (sin levantar servidor) y las pruebas del caso feliz
    - `["1INF25","1INF27","1INF49"]` → 200 con exactamente 27 cursos, incluyendo `1INF29`, `1INF30`, `1INF31`, `1INF32` (AC-3).
    - `[]` → 200, solo cursos con `prerequisites: []` (AC-4).
    - `["1INF25"]` (falta `1INF27`) → `1INF32` NO aparece (AC-2).
    - `["ZZZZ99"]` (código válido desconocido) → 200, no 400 ni 500 (AC-10).
    - _Requisitos: 1.2, 1.3, 1.4, 4.2 (AC-2, AC-3, AC-4, AC-10)_
  - [x] 5.2 Pruebas del formato de la respuesta
    - Cada objeto con exactamente `id`, `name`, `credits`, `cycle`, `type`, `prerequisites` (tipos correctos) (AC-11); header `Content-Type: application/json` (AC-12).
    - _Requisitos: 5.1, 5.2 (AC-11, AC-12)_
  - [x] 5.3 Pruebas de validación de entrada (cada caso una sola vez)
    - Content-Type `text/plain` → 400 (AC-5); body JSON no parseable → 400, no 500 (AC-5); `{}` sin clave `aprobados` → 400 (AC-6); `aprobados` como string/number/object → 400 (AC-7); exactamente 100 elementos válidos → 200 y 101 → 400 (AC-8); códigos de 5 y 7 caracteres y `1INF30<script>` → 400 sin stack traces ni rutas en el body (AC-9).
    - _Requisitos: 2.1, 2.2, 2.3, 3.1, 4.1 (AC-5 a AC-9)_
  - [x] 5.4 Verificar que ningún body de error contiene stack traces ni rutas de archivos
    - _Requisitos: 2.1, 4.1 (AC-5, AC-9)_

- [x] 6. Ejecutar las pruebas y verificar la cobertura
  - [x] 6.1 Ejecutar `npx jest --run` y asegurar que todas las pruebas pasan (nuevas y existentes)
    - Ensure all tests pass, ask the user if questions arise.
    - _Requisitos: 6.1 (AC-13)_
  - [x] 6.2 Ejecutar `npx jest --coverage --run` y verificar cobertura global de líneas ≥ 80 %
    - Ajustar pruebas si la cobertura es insuficiente.
    - _Requisitos: 6.1 (AC-13)_

## Notes

- Dependencias: 2 depende de 1; 3 depende de 2; 4 depende de 3; 5 depende de 4; 6 depende de 5.
- Todos los 13 ACs quedan cubiertos: AC-1 a AC-4 y AC-10 (tarea 3), AC-5 a AC-9 (tareas 2 y 4), AC-3/AC-11/AC-12 (tareas 3 y 5), AC-13 (tarea 6).
- Sin dependencias nuevas ni herramientas de prueba adicionales; el repositorio no se modifica.
- Los detalles de implementación (código de la ruta, cambios exactos en `errores.js`, casos completos de prueba) están en design.md.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["4.2"] },
    { "id": 8, "tasks": ["5.1"] },
    { "id": 9, "tasks": ["5.2"] },
    { "id": 10, "tasks": ["5.3"] },
    { "id": 11, "tasks": ["5.4"] },
    { "id": 12, "tasks": ["6.1"] },
    { "id": 13, "tasks": ["6.2"] }
  ]
}
```
