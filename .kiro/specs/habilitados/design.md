# Design Document

## Overview

Este documento describe la arquitectura y las decisiones de diseño del endpoint `POST /habilitados` del servicio Malla INF. El endpoint recibe una lista de códigos de cursos aprobados por un alumno y devuelve todos los cursos de la malla para los cuales el alumno está habilitado a matricularse.

## Architecture

### Componentes involucrados

El nuevo endpoint sigue estrictamente la convención establecida por el recurso `/cursos`:

| Componente | Archivo | Rol |
|---|---|---|
| Ruta | `src/routes/habilitados.js` | Define `POST /`, valida la entrada, calcula los habilitados y retorna la respuesta JSON. |
| Lógica de habilitación | `src/routes/habilitados.js` (función interna) | Algoritmo de filtrado puro; vive en el mismo archivo de ruta porque es simple y específica de este endpoint. |
| Repositorio | `src/data/repositorio.js` | Proporciona `listar()` para iterar todos los cursos. No se modifica. |
| Montaje en app | `src/app.js` | `app.use('/habilitados', require('./routes/habilitados'))` antes del middleware de errores. |
| Middleware de errores | `src/middleware/errores.js` | Captura errores no controlados → HTTP 500 genérico. Las validaciones de entrada son HTTP 400 y se manejan directamente en la ruta. |
| Pruebas | `tests/habilitados.test.js` | Tests funcionales con supertest sobre `src/app.js` sin levantar el servidor. |

**Justificación de ubicación de la lógica:** La lógica de habilitación (filtrar cursos con `Set`) es una operación sin estado que sólo combina datos del repositorio con el input del request. No necesita extracción a `src/util/` a menos que sea reutilizada desde otro módulo; por ahora, mantenerla en la ruta reduce la indirección y es consistente con el patrón de `cursos.js`.

### Integración con `src/app.js`

```javascript
// En src/app.js, antes del middleware de errores existente:
app.use('/habilitados', require('./routes/habilitados'));
app.use(require('./middleware/errores'));  // ya existe, no se modifica
```

`express.json()` ya está montado globalmente en `app.js`, por lo que el body está disponible como `req.body` al llegar a la ruta. Nota importante: cuando el `Content-Type` **no** es `application/json`, `express.json()` **no lanza ningún error**; simplemente no parsea y `req.body` queda como `undefined`. Por eso la verificación del `Content-Type` es explícita en el handler de la ruta (paso 2a del flujo). Cuando el `Content-Type` sí es `application/json` pero el cuerpo es JSON inválido, `express.json()` llama `next(err)` con `err.status: 400` y `err.type: 'entity.parse.failed'`; ese error se intercepta con el cambio mínimo en `errores.js` (paso 2b) para retornar 400 en lugar de 500 (AC-5).

## Processing Flow

El siguiente flujo se aplica a cada request `POST /habilitados`, en orden estricto:

```
1. Recepción del request
   │
2a. Verificación explícita de Content-Type en la ruta
   │  req.is('application/json') === false → 400 { "error": "..." }  (AC-5)
   │  (express.json() NO lanza error cuando Content-Type es incorrecto;
   │   simplemente no parsea y deja req.body === undefined)
   │
2b. Error de parseo de JSON (body inválido con Content-Type correcto)
   │  express.json() llama next(err) con err.status === 400 / err.type === 'entity.parse.failed'
   │  → interceptado por errores.js (con la corrección mínima) → 400 { "error": "..." }  (AC-5)
   │
3. Verificación de presencia de clave `aprobados` en req.body
   │  Ausente → 400 { "error": "..." }  (AC-6)
   │
4. Verificación de tipo: Array.isArray(req.body.aprobados)
   │  No es array → 400 { "error": "..." }  (AC-7)
   │
5. Verificación de tamaño: aprobados.length <= 100
   │  Más de 100 elementos → 400 { "error": "..." }  (AC-8)
   │
6. Verificación de formato por elemento: /^[A-Za-z0-9]{6}$/.test(codigo)
   │  Algún elemento inválido → 400 { "error": "..." }  (AC-9)
   │
7. Cálculo de cursos habilitados
   │  - Construir Set<string> a partir de aprobados  (O(n))
   │  - Iterar repositorio.listar()
   │  - Incluir curso si: id ∉ aprobadosSet AND prerequisites.every(p => aprobadosSet.has(p))
   │  (AC-1, AC-2, AC-4, AC-10)
   │
8. Construcción y envío de respuesta JSON
      HTTP 200, Content-Type: application/json
      Array de objetos de curso tal como están en el repositorio  (AC-11, AC-12)
```

## Components and Interfaces

### `src/routes/habilitados.js`

```javascript
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
```

### Manejo de errores de parseo JSON (AC-5)

`express.json()` lanza un error con `status: 400` y `type: 'entity.parse.failed'` cuando el `Content-Type` **es** `application/json` pero el cuerpo no es JSON válido. Para interceptarlo antes del manejador genérico de 500, se aplica el **cambio mínimo** al `src/middleware/errores.js` existente: agregar una verificación al inicio de la función para detectar errores de parseo y retornar 400 en su lugar.

**Cambio mínimo a `src/middleware/errores.js`:**

```javascript
// Cambio mínimo: agregar la condición al tope de la función existente.
// Se preserva console.error y la lógica de 500 sin modificaciones.
function manejadorErrores(err, req, res, next) {
  if (err.status === 400 || err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'cuerpo de solicitud inválido o Content-Type incorrecto' });
  }
  console.error(err);
  res.status(500).json({ error: 'error interno del servidor' });
}
```

Este cambio mínimo no reescribe el middleware: sólo antepone una condición y mantiene `console.error` y el 500 intactos.

## Data Models

### Request

```
POST /habilitados
Content-Type: application/json

{
  "aprobados": ["1INF25", "1INF27", "1INF49"]
}
```

Restricciones del campo `aprobados`:
- Tipo: `Array` de strings
- Tamaño: 0 a 100 elementos (AC-8)
- Formato de cada elemento: exactamente 6 caracteres alfanuméricos `^[A-Za-z0-9]{6}$` (AC-9)
- Los códigos que no existan en el repositorio son válidos y se tratan como aprobados (AC-10)

### Response exitosa (HTTP 200)

```json
[
  {
    "id": "1INF29",
    "name": "Sistemas Operativos",
    "credits": 2.5,
    "cycle": 6,
    "type": "obligatorio",
    "prerequisites": ["1INF25"]
  },
  ...
]
```

Campos de cada objeto (AC-11):
- `id`: string, 6 caracteres alfanuméricos
- `name`: string
- `credits`: number (e.g. `3.5`, `3.75`)
- `cycle`: entero en el rango 5–10 para cursos obligatorios, `null` para electivos
- `type`: string (`"obligatorio"` o `"electivo"`)
- `prerequisites`: array de strings con los ids de los prerequisitos, tal como se almacenan en el repositorio

**Semántica de referencia y no-mutación:** `repositorio.listar()` devuelve referencias a los mismos objetos del Map interno, que son los objetos parseados de `cursos.json`. Como la respuesta se construye por referencia, cualquier mutación futura de los objetos de respuesta mutaría el repositorio. Para el cumplimiento de AC-11, la ruta **no debe** mutar los objetos retornados — el algoritmo de filtrado ya satisface esto (solo lee `id` y `prerequisites`), y `res.json()` serializa sin mutar. En este dataset los objetos tienen exactamente los 6 campos especificados, por lo que el retorno directo es suficiente y no se necesita proyección de campos. Si se prefiriera un enfoque defensivo, podría aplicarse una selección superficial de campos (`({ id, name, credits, cycle, type, prerequisites }) => ...`), pero no es estrictamente necesario dado el modelo de datos.

### Response de error (HTTP 400)

```json
{ "error": "<mensaje genérico>" }
```

## Eligibility Algorithm

El algoritmo implementa la definición de **Curso habilitado** del glosario:

```
aprobadosSet = new Set(aprobados)

habilitados = repositorio.listar().filter(curso =>
  !aprobadosSet.has(curso.id)                                // no ya aprobado
  AND curso.prerequisites.every(p => aprobadosSet.has(p))   // todos los prereqs aprobados
)
```

**Complejidad:**
- Construcción del Set: O(|aprobados|)
- Filtrado: O(|cursos| × |max_prerequisites|) ≈ O(87 × k), donde k es el número máximo de prerequisitos de un curso (a lo sumo ~3 en el dataset actual)
- Total: O(n + m) donde n = |aprobados|, m = |cursos_repositorio|

**Propiedades del algoritmo:**
- Cursos con `prerequisites: []` son habilitados si su `id` ∉ `aprobadosSet` (AC-1, AC-4)
- Cursos con algún prerequisito ausente en `aprobadosSet` quedan excluidos (AC-2)
- Un código desconocido se agrega a `aprobadosSet` igual que cualquier otro; por lo tanto, si algún curso del repositorio lista ese código como prerequisito, ese prerequisito cuenta como satisfecho. El Set no distingue entre códigos presentes y ausentes del repositorio: la prueba de pertenencia es uniforme, lo que hace el comportamiento correcto por construcción (AC-10)
- El repositorio **no se muta**; `listar()` devuelve referencias a los objetos del Map, que se retornan directamente en la respuesta

## Error Handling

| Condición | Código | Cuerpo |
|---|---|---|
| Content-Type no es `application/json` (verificado explícitamente en la ruta) | 400 | `{ "error": "Content-Type debe ser application/json" }` (AC-5) |
| JSON inválido con Content-Type correcto (`entity.parse.failed`, interceptado por `errores.js` con cambio mínimo) | 400 | `{ "error": "cuerpo de solicitud inválido o Content-Type incorrecto" }` (AC-5) |
| Falta clave `aprobados` | 400 | `{ "error": "falta el campo aprobados" }` (AC-6) |
| `aprobados` no es array | 400 | `{ "error": "aprobados debe ser un array" }` (AC-7) |
| `aprobados` tiene más de 100 elementos | 400 | `{ "error": "aprobados no puede superar 100 elementos" }` (AC-8) |
| Algún código no cumple `^[A-Za-z0-9]{6}$` | 400 | `{ "error": "cada código debe tener exactamente 6 caracteres alfanuméricos" }` (AC-9) |
| Error interno no controlado | 500 | `{ "error": "error interno del servidor" }` |

**Reglas de seguridad en los mensajes de error:**
- Ningún mensaje expone stack traces, rutas de archivos del sistema, ni información interna del servidor.
- Los mensajes de error son genéricos e informativos solo desde la perspectiva del cliente.
- El middleware `errores.js` existente garantiza la cobertura de los errores 500.

## Design Decisions

### Decisión 1: Límite de 100 elementos y rechazo con 400 ante códigos inválidos

**ACs:** AC-8, AC-9

Sin un límite de tamaño, un atacante puede enviar `"aprobados"` con miles de códigos (p. ej. 5000), forzando al servidor a construir un Set masivo e iterar el repositorio en cada request, dejándolo irresponsivo. El límite de 100 es generoso para cualquier alumno real (el plan completo tiene 87 cursos) y protege contra este abuso.

Rechazar con 400 (en lugar de ignorar) cualquier código que no cumpla `^[A-Za-z0-9]{6}$` responde a dos hallazgos:
1. Un código como `1INF30<script>` podría disparar comportamientos inesperados si se propagase al sistema sin validación.
2. El cuerpo de error no contendrá el código malicioso reflejado textualmente, eliminando el riesgo de reflexión de contenido.
3. Fallar rápido en la validación es más seguro y predecible que el silencio: el cliente sabe con precisión qué corregir.

### Decisión 2: Códigos válidos pero inexistentes en el repositorio se tratan como aprobados

**AC:** AC-10

La regla de habilitación es una prueba de pertenencia a un conjunto, no una consulta de existencia en el repositorio. Un alumno puede haber aprobado cursos de otra carrera, cursos dados de baja, o cursos de un plan anterior; esos códigos son legítimos desde la perspectiva del alumno pero ausentes del `cursos.json` del plan 2026-1. Rechazarlos con 400 obligaría al cliente a filtrar `aprobados` contra el repositorio antes de llamar a este endpoint, creando una dependencia innecesaria y rompiendo el principio de que el servidor es la fuente de verdad. La operación correcta es agregar el código desconocido al `aprobadosSet` igual que cualquier otro: si algún curso del repositorio lista ese código como prerequisito, ese prerequisito cuenta como satisfecho; si ningún curso lo referencia, no hay efecto sobre el resultado. El cálculo es correcto por construcción y no requiere ningún tratamiento especial para códigos desconocidos.

### Decisión 3: Lógica de habilitación en la misma ruta (no en `src/util/`)

La función `calcularHabilitados` es una transformación pura de datos que no se comparte con ningún otro módulo actual. Mantenerla en `src/routes/habilitados.js` como función privada evita crear abstracciones prematuras, es consistente con el patrón de `cursos.js`, y simplifica la trazabilidad entre las validaciones y el cálculo. Si en el futuro se requiere desde otro endpoint, se puede mover a `src/util/` sin impacto externo.

### Decisión 4: Reutilización de `repositorio.listar()` sin acceso directo al JSON

**ACs:** AC-1, AC-11

El repositorio ya garantiza la carga única del JSON y la consistencia de los datos. Acceder directamente a `data/cursos.json` desde la ruta violaría el principio de única fuente de verdad implementado en `repositorio.js` y duplicaría lógica de carga. `listar()` retorna referencias a los objetos del Map, que son los mismos objetos que `obtener()` devuelve para las rutas de `/cursos`, garantizando consistencia de campos (AC-11).

## Testing Strategy

El archivo de pruebas es `tests/habilitados.test.js`, usando supertest sobre `src/app` (mismo patrón que `tests/cursos.test.js`).

### Pruebas funcionales principales

| Caso | Input `aprobados` | Resultado esperado | AC |
|---|---|---|---|
| Conjunto de referencia | `["1INF25","1INF27","1INF49"]` | 200, array de exactamente 27 cursos incluyendo `1INF29`, `1INF30`, `1INF31`, `1INF32` | AC-3 |
| Array vacío | `[]` | 200, solo cursos con `prerequisites: []` | AC-4 |
| Curso excluido por prerequisito faltante | `["1INF25"]` (falta `1INF27`) | `1INF32` NO debe aparecer en la respuesta | AC-2 |
| Código válido pero desconocido | `["ZZZZ99"]` | 200 (no 400 ni 500) | AC-10 |
| Respuesta incluye todos los campos | Cualquier entrada válida | Cada objeto tiene `id`, `name`, `credits`, `cycle`, `type`, `prerequisites` como array de strings | AC-11 |
| Content-Type de respuesta | Cualquier entrada válida | Encabezado `Content-Type: application/json` | AC-12 |

### Pruebas de validación (casos de error → 400)

| Caso | Input | Código esperado | AC |
|---|---|---|---|
| Content-Type: text/plain | Body `{}` con header incorrecto | 400 | AC-5 |
| Body no es JSON | `"no-es-json"` como cuerpo raw | 400 | AC-5 |
| Sin clave `aprobados` | `{}` | 400 | AC-6 |
| `aprobados` como string | `{"aprobados": "1INF25"}` | 400 | AC-7 |
| `aprobados` como número | `{"aprobados": 42}` | 400 | AC-7 |
| `aprobados` como objeto | `{"aprobados": {}}` | 400 | AC-7 |
| Exactamente 100 elementos válidos | array de 100 códigos de 6 chars | 200 | AC-8 |
| 101 elementos válidos | array de 101 códigos de 6 chars | 400 | AC-8 |
| Código con 5 chars | `["1INF2"]` | 400 | AC-9 |
| Código con 7 chars | `["1INF250"]` | 400 | AC-9 |
| Código con carácter especial | `["1INF30<script>"]` → no cumple patrón | 400, sin stack trace en body | AC-9 |
| Respuesta de error no expone internos | Cualquier input inválido | body es `{ "error": "..." }` sin rutas ni stack | AC-5, AC-9 |

### Pruebas de cobertura

Ejecutar `jest --coverage` y verificar que la cobertura global de líneas sea ≥ 80% (AC-13). La combinación de los tests de `habilitados.test.js` más los ya existentes en `cursos.test.js`, `health.test.js` y `repositorio.test.js` cubre las líneas del repositorio, las rutas, el middleware de errores y la nueva lógica de habilitación.

## Security Considerations

- **Validación temprana y en orden:** las verificaciones se realizan de más barata a más cara (tipo → estructura → tamaño → formato → cálculo), lo que minimiza el trabajo ante entradas maliciosas.
- **Sin reflexión de input en errores:** los mensajes de error son mensajes estáticos; el código inválido no se incluye en el body de respuesta, evitando reflexión de contenido.
- **Sin mutación de datos del repositorio:** el algoritmo construye estructuras temporales (`Set`, array filtrado) sin modificar los objetos del Map interno del repositorio.
- **Sin dependencias nuevas:** la validación usa `Array.isArray`, `RegExp.test` y `Set`, todos primitivos nativos de Node.js, sin dependencias adicionales.
- **Consistencia con `errores.js`:** todos los errores no controlados siguen retornando 500 con mensaje genérico; sólo las validaciones de entrada retornan 400 desde la ruta.

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe ser verdadero en todas las ejecuciones válidas del sistema — esencialmente, una afirmación formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de corrección verificables automáticamente.*

### Property 1: Cursos habilitados cumplen la condición de habilitación

*Para cualquier* array `aprobados` válido (≤ 100 elementos, cada uno con 6 chars alfanuméricos), todos los cursos en la respuesta HTTP 200 deben tener su `id` ausente en `aprobados` y todos sus `prerequisites` presentes en `aprobados`. (Cubre AC-1, AC-2)

**Validates: Requirements 1.1, 1.2**

### Property 2: Cursos no habilitados están ausentes de la respuesta

*Para cualquier* array `aprobados` válido, ningún curso cuyo id esté en `aprobados` o cuyo array `prerequisites` contenga al menos un elemento ausente de `aprobados` debe aparecer en la respuesta. (Cubre AC-1, AC-2)

**Validates: Requirements 1.1, 1.2**

### Property 3: Con aprobados vacío, solo se devuelven cursos sin prerequisitos

*Para cualquier* respuesta exitosa con `aprobados = []`, todos los cursos devueltos deben tener `prerequisites` igual a `[]`. (Cubre AC-4)

**Validates: Requirements 1.4**

### Property 4: Valores no-array para aprobados siempre producen 400

*Para cualquier* valor que no sea un Array JSON (string, number, object, null, boolean), enviarlo como valor de `aprobados` debe producir HTTP 400. (Cubre AC-7)

**Validates: Requirements 2.3**

### Property 5: Arrays con más de 100 elementos producen 400

*Para cualquier* array `aprobados` con más de 100 elementos (todos sintácticamente válidos), el sistema debe responder HTTP 400. (Cubre AC-8)

**Validates: Requirements 3.1**

### Property 6: Códigos con formato inválido producen 400

*Para cualquier* string que no cumpla `^[A-Za-z0-9]{6}$` (longitud incorrecta o carácter no alfanumérico), incluirlo en `aprobados` debe producir HTTP 400 y el cuerpo de error no debe contener stack traces ni rutas del sistema de archivos. (Cubre AC-9)

**Validates: Requirements 4.1**

### Property 7: La respuesta exitosa siempre incluye los campos requeridos

*Para cualquier* array `aprobados` válido, cada objeto en el array de respuesta debe contener exactamente los campos `id` (string), `name` (string), `credits` (number), `cycle` (entero 5–10 o `null` para electivos), `type` (string) y `prerequisites` (array de strings). (Cubre AC-11)

**Validates: Requirements 5.1**
