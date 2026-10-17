# Convención de codificación del proyecto

Versión 1.0 — adoptada al inicio del Sprint 4 (Práctica 08). Toda contribución que no la respete se
corrige en la revisión del Pull Request antes de integrarse a `main`.

## 1. Principios generales

| Principio | Aplicación en el proyecto |
|---|---|
| Responsabilidad única (SOLID-S) | Un controlador por recurso REST; un servicio por caso de uso (CU-03, CU-04, CU-06). |
| Inversión de dependencias (SOLID-D) | La capa Application depende de interfaces (`IBicicletaRepositorio`); Infrastructure las implementa. |
| Código limpio | Funciones ≤ 30 líneas, sin código muerto ni comentado, nombres que expresan intención. |
| Idioma | Términos de dominio en español sin tildes (`Bicicleta`, `AuditoriaAcceso`, `conciliarLote`); sufijos técnicos del framework en inglés (`Controller`, `Service`, `Repository`, `Async`). |
| Seguridad | Sin cadenas de conexión, claves ni contraseñas en el código; sin concatenación de SQL; sin registro (logs) de contraseñas ni descriptores biométricos. |

## 2. C# — API ASP.NET Core 10 (LTS)

| Elemento | Convención | Ejemplo |
|---|---|---|
| Clases, records, enums, métodos, propiedades | PascalCase | `AutorizarRetiroService`, `EstadoBicicleta.Dentro` |
| Interfaces | Prefijo `I` + PascalCase | `IAuditoriaRepositorio` |
| Parámetros y variables locales | camelCase | `idVigilante`, `distancia` |
| Campos privados | `_camelCase` | `_politica` |
| Constantes | PascalCase | `Dimensiones = 128` |
| Métodos asíncronos | Sufijo `Async` y `CancellationToken` como último parámetro | `ObtenerConBloqueoAsync(id, ct)` |
| DTO | `record` con sufijo `Request` / `Response` | `RetiroRequest`, `RetiroResponse` |
| Archivos | Un tipo público por archivo; nombre del archivo = nombre del tipo | `PoliticaBiometrica.cs` |
| Espacios de nombres | Con ámbito de archivo, reflejan la carpeta | `namespace Bicicletas.Domain.Biometria;` |
| Nulabilidad | `<Nullable>enable</Nullable>` en todos los proyectos | — |
| Controladores | Delgados: validan, delegan al servicio y traducen el resultado HTTP | — |
| Errores de negocio | Excepciones de dominio traducidas por middleware a 404 / 409 / 422 | `ConflictoEstadoException` → 409 |
| Pruebas xUnit | `Metodo_Condicion_ResultadoEsperado` | `EsCoincidente_DistanciaIgualAlUmbral_Acepta` |

Herramientas: `dotnet format` y analizadores .NET (`<AnalysisLevel>latest-recommended</AnalysisLevel>`).

## 3. JavaScript / React — SPA

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes | PascalCase, un componente por archivo `.jsx` | `PanelGarita.jsx`, `ProtectedRoute.jsx` |
| Hooks | Prefijo `use` | `useSesion`, `useCamaraGarita` |
| Funciones y variables | camelCase | `distanciaEuclidiana`, `registrarIngreso` |
| Constantes de configuración | UPPER_SNAKE_CASE | `UMBRAL_THETA`, `DIMENSIONES_DESCRIPTOR` |
| Utilidades | camelCase `.js` | `distanciaEuclidiana.js` |
| Carpetas de pantalla | `src/features/<modulo>` (una por pantalla W1–W7) | `src/features/garita/` |
| Pruebas | Junto al archivo probado: `*.test.js(x)` con Vitest + React Testing Library | `ProtectedRoute.test.jsx` |
| Variables de entorno | Prefijo `VITE_`, solo valores públicos | `VITE_API_URL`, `VITE_UMBRAL_THETA` |
| Estilo | ESLint (reglas `react-hooks`) + Prettier; sin `console.log` en código integrado | — |
| Sesión | JWT en `sessionStorage` (se elimina al cerrar la pestaña); nunca en `localStorage` | — |

## 4. SQL — PostgreSQL 17

| Elemento | Convención | Ejemplo |
|---|---|---|
| Tablas | snake_case en plural | `bicicletas`, `contingencias_ingreso` |
| Columnas | snake_case | `hora_ingreso_manual` |
| Llave primaria | `id_<entidad en singular>`, UUID `gen_random_uuid()` (salvo catálogos y bitácoras) | `id_bicicleta UUID` |
| Llave foránea | Mismo nombre que la PK referenciada | `id_estudiante` |
| Restricciones | Prefijos `chk_`, `uq_`, `fk_`, `idx_` | `chk_vector_128`, `uq_movimiento_contingencia` |
| Palabras reservadas | MAYÚSCULAS | `SELECT … FOR UPDATE` |
| Migraciones | `database/migrations/V###__descripcion.sql`; inmutables una vez integradas a `main` (un cambio = una migración nueva) | `V003__cc10_contingencias_csv.sql` |
| Funciones | `SET search_path = public`; permisos revocados a `anon` y `authenticated` | `conciliar_contingencia` |

## 5. Ramas (estrategia basada en tronco)

| Rama | Uso | Regla |
|---|---|---|
| `main` | Versión integrada y desplegable | Protegida: solo por Pull Request, con el pipeline CI en verde y 1 revisión del otro integrante |
| `feat/<cu>-<descripcion>` | Nueva funcionalidad | `feat/cu-04-retiro-facial` |
| `fix/<descripcion>` | Corrección de defecto | `fix/qr-uuid-mayusculas` |
| `ci/`, `chore/`, `docs/`, `refactor/`, `test/` | Mantenimiento | `ci/sonarcloud` |

Las ramas viven como máximo 3 días; se eliminan tras la fusión. Cada incremento aceptado se etiqueta:
`v0.<n>.0` (por ejemplo `v0.3.0-sprint3`).

## 6. Mensajes de commit (Conventional Commits, en español)

Formato: `<tipo>(<ámbito>): <descripción en imperativo, minúsculas, máximo 72 caracteres>`

- Tipos: `feat`, `fix`, `test`, `refactor`, `docs`, `ci`, `build`, `chore`.
- Ámbitos: `repo`, `db`, `api`, `web`, `auth`, `garita`, `retiro`, `biometria`, `contingencias`, `monitoreo`, `usuarios`, `ci`, `sonar`.
- Cuerpo opcional: el porqué del cambio. Pie: trazabilidad `Refs: CU-04, RF-07`.

```text
feat(retiro): recalcular la distancia euclidiana en el servidor

La decisión de autorizar el retiro ya no depende del valor enviado por el
navegador (OWASP A04). El descriptor transitorio no se persiste.

Refs: CU-04, RF-06, RF-07, RNF-04
```

No se admiten mensajes sin contenido (`fixed`, `ayuda`, `cambios`), commits que mezclen varias
funcionalidades ni un único commit final con todo el código.

## 7. Definición de Terminado (criterio de aceptación para la regla 0/100 del EVM)

Un entregable de sprint se considera aceptado —y solo entonces suma su valor ganado— cuando:

1. Está fusionado en `main` mediante Pull Request.
2. El pipeline CI termina en verde (pruebas de BD, API y Web).
3. El Quality Gate de SonarCloud está aprobado o sus hallazgos están registrados con su corrección.
4. La bitácora del sprint está actualizada con el rango de commits y la etiqueta.
5. El incremento se demostró al asesor.
