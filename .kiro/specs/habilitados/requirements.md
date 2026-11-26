# Requirements Document

## Introduction

Este documento describe los requisitos del endpoint `POST /habilitados` del servicio Malla INF.
El endpoint recibe una lista de códigos de cursos aprobados y devuelve todos los cursos de la malla para los cuales el alumno cumple los requisitos de entrada: cursos que no estén en la lista de aprobados y cuyos prerequisitos (si los tienen) estén todos incluidos en dicha lista.

Con la entrada de ejemplo `{ "aprobados": ["1INF25", "1INF27", "1INF49"] }`, la respuesta debe contener exactamente 27 cursos, incluyendo 1INF29, 1INF30, 1INF31 y 1INF32.

## Glossary

- **API**: Interfaz de programación de aplicaciones; en este contexto, el servicio REST en Express.
- **aprobados**: Array JSON de cadenas de texto que representan códigos de cursos aprobados por el alumno.
- **Código de curso**: Identificador único de un curso, compuesto exactamente por 6 caracteres alfanuméricos (letras A-Z, a-z y dígitos 0-9), patrón `^[A-Za-z0-9]{6}$`.
- **Curso habilitado**: Curso cuyo código no está en `aprobados` y cuyos prerequisitos (si los tiene) están todos presentes en `aprobados`.
- **Prerequisito**: Código de un curso que debe estar en `aprobados` para que el curso dependiente sea habilitado.
- **Repositorio**: Módulo interno que carga y expone los datos de `cursos.json`.
- **Sistema**: El servidor Express que implementa la API Malla INF.

## Requirements

### Requirement 1: Cálculo de cursos habilitados

**User Story:** Como alumno, quiero enviar la lista de cursos que aprobé y recibir los cursos que puedo llevar a continuación, para planificar mi matrícula de forma precisa.

#### Acceptance Criteria

- AC-1: CUANDO el Sistema recibe una solicitud `POST /habilitados` con un cuerpo JSON válido que contiene un array `aprobados` de códigos de curso, EL SISTEMA DEBERÁ responder con HTTP 200 y un array JSON de objetos de curso para cada curso del Repositorio cuyo `id` no esté en `aprobados` y cuyos todos los prerequisitos estén presentes en `aprobados`; los cursos con array `prerequisites` vacío también son incluidos si su `id` no está en `aprobados`.

- AC-2: CUANDO el Sistema recibe una solicitud `POST /habilitados` y un curso del Repositorio tiene un array `prerequisites` vacío y su `id` no está en `aprobados`, EL SISTEMA DEBERÁ incluir ese curso en el array de respuesta.

- AC-3: CUANDO el Sistema recibe una solicitud `POST /habilitados` con `"aprobados": ["1INF25", "1INF27", "1INF49"]`, EL SISTEMA DEBERÁ retornar un array JSON que contenga exactamente 27 objetos de curso, incluyendo los cursos con ids `1INF29`, `1INF30`, `1INF31` y `1INF32`.

- AC-4: CUANDO el Sistema recibe una solicitud `POST /habilitados` con `"aprobados": []` (array vacío), EL SISTEMA DEBERÁ responder con HTTP 200 y un array JSON que contenga únicamente los cursos cuyo array `prerequisites` esté vacío.

### Requirement 2: Validación de la solicitud — tipo y estructura

**User Story:** Como alumno, quiero que el sistema rechace entradas malformadas con mensajes claros, para corregir mis peticiones sin ver información interna del servidor.

#### Acceptance Criteria

- AC-5: SI el encabezado `Content-Type` de una solicitud `POST /habilitados` no es `application/json` o el cuerpo de la solicitud no es parseable como JSON, ENTONCES EL SISTEMA DEBERÁ responder con HTTP 400 y un cuerpo JSON `{ "error": "<mensaje genérico>" }` que no contenga stack traces, rutas de archivos ni información interna del servidor.

- AC-6: SI el cuerpo JSON parseado de una solicitud `POST /habilitados` no contiene la clave `aprobados`, ENTONCES EL SISTEMA DEBERÁ responder con HTTP 400 y un cuerpo JSON `{ "error": "<mensaje genérico>" }`.

- AC-7: SI el valor de `aprobados` en el cuerpo de la solicitud no es un Array JSON (por ejemplo, una cadena de texto o un número), ENTONCES EL SISTEMA DEBERÁ responder con HTTP 400 y un cuerpo JSON `{ "error": "<mensaje genérico>" }` que no contenga stack traces, rutas de archivos ni información interna del servidor.

### Requirement 3: Validación del tamaño del array

**User Story:** Como operador del servicio, quiero que el endpoint rechace arrays excesivamente grandes, para evitar que el servidor quede irresponsivo por peticiones abusivas.

#### Acceptance Criteria

- AC-8: SI el array `aprobados` contiene más de 100 elementos, ENTONCES EL SISTEMA DEBERÁ responder con HTTP 400 y un cuerpo JSON `{ "error": "<mensaje genérico>" }`.

### Requirement 4: Validación del formato de cada código

**User Story:** Como operador del servicio, quiero que el endpoint rechace códigos con caracteres especiales o longitud incorrecta, para prevenir que entradas maliciosas provoquen errores internos o expongan información del servidor.

#### Acceptance Criteria

- AC-9: SI algún elemento del array `aprobados` no coincide con el patrón `^[A-Za-z0-9]{6}$` (exactamente 6 caracteres alfanuméricos), ENTONCES EL SISTEMA DEBERÁ responder con HTTP 400 y un cuerpo JSON `{ "error": "<mensaje genérico>" }` que no contenga stack traces, rutas de archivos ni información interna del servidor.

- AC-10: CUANDO el array `aprobados` contiene un código que es sintácticamente válido (coincide con `^[A-Za-z0-9]{6}$`) pero no existe en el Repositorio, EL SISTEMA DEBERÁ tratar ese código como un curso aprobado a efectos del cálculo de habilitación y responder con HTTP 200 y el array de cursos resultante. *(Nota: la justificación de esta decisión de diseño se detallará en design.md.)*

### Requirement 5: Formato de la respuesta exitosa

**User Story:** Como alumno, quiero que cada curso habilitado devuelva todos sus campos, para mostrarlos directamente en la interfaz sin llamadas adicionales.

#### Acceptance Criteria

- AC-11: CUANDO el Sistema retorna una respuesta exitosa a `POST /habilitados`, EL SISTEMA DEBERÁ incluir en cada objeto de curso exactamente los campos `id` (string), `name` (string), `credits` (number, p. ej. 3.5 o 3.75), `cycle` (entero entre 5 y 10), `type` (string) y `prerequisites` (array de strings con los ids de los prerequisitos, tal como se almacenan en el Repositorio).

- AC-12: CUANDO el Sistema retorna una respuesta exitosa a `POST /habilitados`, EL SISTEMA DEBERÁ establecer el encabezado de respuesta `Content-Type` a `application/json`.

### Requirement 6: Calidad — cobertura de pruebas

**User Story:** Como equipo de desarrollo, quiero que el endpoint esté cubierto por pruebas automatizadas, para detectar regresiones de forma confiable.

#### Acceptance Criteria

- AC-13: CUANDO Jest es ejecutado con el flag `--coverage` sobre la suite de pruebas que incluye tests para `POST /habilitados`, EL SISTEMA DEBERÁ reportar un porcentaje de cobertura de líneas igual o mayor al 80% para los archivos que implementan la lógica del endpoint.
