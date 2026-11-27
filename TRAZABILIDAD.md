# Trazabilidad

## Requisito → gate → evidencia

La siguiente tabla relaciona los requisitos no funcionales de seguridad y calidad con sus mecanismos de verificación. Se incluyen las evidencias de corrección disponibles. No se registran ejecuciones fallidas de GitHub Actions que no hayan ocurrido; cuando no existe una ejecución fallida conservada, se identifica expresamente esa limitación.

| Requisito | Gate (herramienta y umbral) | Bloquea / avisa | Etapa | Evidencia de fallo o prueba de regresión | Evidencia de corrección |
|---|---|---|---|---|---|
| SR-1 — Abuso de recursos (DoS por array excesivo). AC-8 | Jest: `tests/habilitados.test.js`, límite máximo de 100 elementos | Bloquea la solicitud: responde HTTP 400 si supera 100 elementos | Pruebas automatizadas del job `build` | Test `101 elementos válidos → 400`, que reproduce la entrada excesiva | Test `exactamente 100 elementos válidos → 200` y `101 elementos válidos → 400`. Pipeline: [Run #2](https://github.com/vitayien/INF384-lab6-base/actions/runs/45913884809) |
| SR-2 — Entrada maliciosa en códigos de curso. AC-9 | Jest: validación con expresión regular `^[A-Za-z0-9]{6}$` | Bloquea la solicitud: responde HTTP 400 y no refleja el contenido malicioso | Pruebas automatizadas del job `build` | Test `código con carácter especial "1INF30<script>" → 400` | Test de validación y test `el body de error no contiene stack trace ni rutas de archivos`. Pipeline: [Run #2](https://github.com/vitayien/INF384-lab6-base/actions/runs/45913884809) |
| SR-3 — Exposición de información interna. AC-5 | Jest: pruebas de Content-Type y parseo JSON, más comprobación del cuerpo de error | Bloquea la solicitud inválida con HTTP 400; no expone stack traces ni rutas internas | Pruebas automatizadas del job `build` | Tests `Content-Type: text/plain → 400` y `body no parseable como JSON → 400, no 500` | Test `el body de error no contiene stack trace ni rutas de archivos`. Pipeline: [Run #2](https://github.com/vitayien/INF384-lab6-base/actions/runs/45913884809) |
| AC-13 — Calidad y cobertura de pruebas | Jest con `--coverage`; umbral mínimo global de líneas: 80 % | Bloquea si la cobertura no alcanza el umbral configurado | Job `build`, ejecución de `npm test` | La cobertura inferior al 80 % provoca el fallo del umbral configurado en Jest | Ejecución local: 98.91 % de cobertura de líneas y 61 pruebas aprobadas. Pipeline: [Run #2](https://github.com/vitayien/INF384-lab6-base/actions/runs/45913884809) |
| Seguridad de dependencias (SCA) | `npm audit --audit-level=high`; umbral HIGH y CRITICAL | Bloquea ante vulnerabilidades HIGH o CRITICAL; severidades inferiores se reportan sin bloquear | Job `build`, después de las pruebas | Se identificó una dependencia vulnerable: `lodash` 4.17.20 | Actualización de `lodash` a 4.18.1 y ejecución satisfactoria del pipeline: [Run #3](https://github.com/vitayien/INF384-lab6-base/actions/runs/45914352322) |
| Detección de secretos | Gitleaks (`gitleaks/gitleaks-action@v2`); cualquier secreto detectado en el historial | Bloquea si detecta secretos | Job `secrets`, en paralelo con `build`, con historial completo (`fetch-depth: 0`) | No se conserva una ejecución fallida de Gitleaks; no se afirma que se haya detectado un secreto real | Ejecución satisfactoria del pipeline: [Run #3](https://github.com/vitayien/INF384-lab6-base/actions/runs/45914352322) |
| Análisis estático de seguridad (SAST) | GitHub CodeQL para JavaScript | Avisa mediante alertas de análisis de código; no bloquea automáticamente sin una regla de protección de ramas | Job `codeql`, en paralelo con `build` | No se conserva una ejecución fallida de CodeQL | Análisis incluido en el workflow de CI: [Run #3](https://github.com/vitayien/INF384-lab6-base/actions/runs/45914352322) |

**Nota sobre las evidencias:** los nombres de pruebas identifican los casos de regresión implementados. No se atribuye a esas pruebas una ejecución fallida histórica que no esté documentada. Los enlaces de GitHub Actions corresponden a ejecuciones satisfactorias conocidas.

## Cambios a la propuesta de Kiro

| Documento | Qué propuso Kiro | Qué cambiaste | Por qué |
|---|---|---|---|
| `design.md` — AC-11, formato de respuesta | La propuesta inicial consideraba `cycle` como un valor numérico para todos los cursos. | Se precisó que `cycle` puede ser `null` para los cursos electivos y un entero entre 5 y 10 para los obligatorios. | El modelo de datos contiene cursos electivos sin ciclo numérico. La especificación debe representar correctamente ambos tipos de curso y evitar exigir un valor inexistente. |
| `design.md` — AC-5, validación de Content-Type | La propuesta inicial no distinguía claramente entre un Content-Type incorrecto y un JSON malformado. | Se documentó la verificación explícita del Content-Type en la ruta y el tratamiento del error de parseo JSON en el middleware de errores. | `express.json()` no genera un error cuando el Content-Type no es JSON: simplemente no parsea el cuerpo. En cambio, un JSON malformado con Content-Type correcto produce un error de parseo. Ambos casos deben responder HTTP 400 sin exponer información interna. |
| `package.json` y archivo de bloqueo de dependencias | La dependencia `lodash` estaba en la versión 4.17.20. | Se actualizó `lodash` a la versión 4.18.1. | Corregir la dependencia vulnerable identificada y reducir el riesgo de utilizar una versión con vulnerabilidades conocidas.</textarea>



Cuando termines, pásame el enlace actualizado de `TRAZABILIDAD.md` y revisamos si queda algún ajuste pendiente.
