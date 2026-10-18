# Registro de hallazgos de análisis estático (SonarCloud) — Práctica 08

Herramienta: SonarCloud (SonarQube Cloud), organización `godridrigo233`, dos proyectos del monorepo:
`godridrigo233_sistema-bicicletas-api` (C#/.NET 10) y `godridrigo233_sistema-bicicletas-web` (React).
El análisis lo ejecuta el pipeline de GitHub Actions en cada push (análisis automático desactivado).

## Primer análisis — rama `main`, 17/10/2026

| Métrica | API | Web |
|---|---|---|
| Líneas de código | 7.1 k (incluía por error el frontend, SQL y workflows) | 4.4 k |
| Issues abiertos | 15 | 5 |
| Security rating | E (4 issues: 1 Blocker, 1 High, 1 Medium, 1 Low) | A |
| Security hotspots | 0 (A) | 0 (A) |
| Duplicación | 0.5 % | 0.8 % |
| Cobertura | 64.8 % | 85.5 % |

## Hallazgos y atención

| ID | Proyecto | Archivo : línea | Tipo / Severidad | Hallazgo | Corrección aplicada | Estado |
|---|---|---|---|---|---|---|
| H-01 | web | `package-lock.json` | Vulnerabilidad / Alta (npm audit) | node-fetch ≤ 2.6.6 (vía face-api.js) | `overrides` a node-fetch 2.7.0 | Corregido |
| H-02 | web | `package.json` | Vulnerabilidad / Moderada (npm audit) | react-router-dom con redirección abierta | Actualización de versión | Corregido |
| H-03 | api | `AutenticacionService.cs:18` | Seguridad / Blocker (secreto en código) | Hash BCrypt literal en el código fuente | El hash ficticio (anti enumeración por tiempo) se genera en memoria al primer uso con un valor aleatorio | Corregido |
| H-04 | api | `.github/workflows/ci.yml:213` | Seguridad / High (cadena de suministro) | Acción de terceros referida por etiqueta | `sonarqube-scan-action` fijada por SHA de commit (v8.3.0) | Corregido |
| H-05 | api | `.github/workflows/ci.yml:197` | Seguridad / Medium | `npm ci` ejecuta scripts de instalación de terceros | `npm ci --ignore-scripts` (build y pruebas siguen en verde) | Corregido |
| H-06 | api | `Program.cs:93` | Confiabilidad / Medium | `app.Run()` síncrono en contexto asíncrono | `await app.RunAsync()` | Corregido |
| H-07 | api | `ContingenciaIngreso.cs:6`, `Estudiante.cs:4` | Confiabilidad / Medium | Clases con solo constructor privado | Constructor `internal` (EF Core las materializa; las filas se crean en SQL/padrón) | Corregido |
| H-08 | web | `RegistroEnrolamiento.jsx:47`, `VerificacionRetiro.jsx:50`, `GestionUsuarios.jsx:68` y efectos de carga | Confiabilidad / Medium | Promesas sin `await`/`catch` | Operador `void` explícito (los errores ya se manejan dentro de cada función) | Corregido |
| H-09 | api | `database/tests/T002__auditoria_inmutable.sql:16,22` | Confiabilidad / Blocker | UPDATE/DELETE sin WHERE | **Falso positivo**: es una prueba negativa que verifica que el trigger de V002 bloquea toda modificación de la auditoría | Justificado |
| H-10 | api | `database/migrations/V001__esquema_base.sql:23` | Confiabilidad / Medium | «Use VARCHAR2 instead of CHAR» | **No aplica**: regla de Oracle PL/SQL; la base es PostgreSQL 17 y DNI CHAR(8) es de longitud fija | Justificado |
| H-11 | api | Configuración del análisis | Alcance | El proyecto API analizaba también frontend, SQL y workflows (duplicaba issues y usaba reglas PL/SQL) | `sonar.exclusions=frontend/**,database/**` en el proyecto API; el SQL se valida con las pruebas T001/T002 sobre PostgreSQL 17 en el job de base de datos | Corregido |

## Análisis tras correcciones

| Métrica | API | Web |
|---|---|---|
| Issues abiertos | [completar] | [completar] |
| Security rating | [completar] | [completar] |
| Cobertura | [completar] | [completar] |
| Duplicación | [completar] | [completar] |
| Quality Gate | [completar] | [completar] |

Además, los analizadores de .NET (`AnalysisLevel latest-recommended`, `TreatWarningsAsErrors` en Release)
bloquean la compilación ante reglas como CA1707, CA1845 y CA1870, que se corrigieron durante el desarrollo.
