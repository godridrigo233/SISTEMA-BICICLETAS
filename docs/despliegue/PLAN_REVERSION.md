# Versión estable y plan de reversión (rollback)

Plan de reversión del sistema para la puesta en marcha (Práctica 10, Gestión de Entregas y Despliegues de ITIL).
Define qué versión se considera estable, cuándo se revierte y cómo se hace en cada capa.

## Versiones

| Etiqueta | Cuándo se crea | Uso |
|---|---|---|
| `v1.0` | Tras el ensayo de 10 retiros con un titular enrolado, si no requiere ajustes | Versión congelada para la Fase B y el piloto. Desde aquí solo se corrigen defectos |

El ensayo se ejecuta con la versión desplegada en `main` (commit `6969d1b`), que se registra en la Práctica 09.

Crear la etiqueta sobre `main` (apunta al despliegue que está en producción), desde la terminal o en GitHub → *Releases* → *Draft a new release* → etiqueta `v1.0` sobre `main`:

```bash
git checkout main && git pull
git tag -a v1.0 -m "Versión estable para la Fase B y el piloto"
git push origin v1.0
```

## Cuándo se revierte

Se revierte a la última versión estable si, después de un despliegue, ocurre cualquiera de estos casos y no se
corrige en 30 minutos:

- La garita no puede registrar ingresos o retiros (error en la API o en la SPA).
- La verificación facial rechaza de forma sistemática a titulares legítimos o deja de capturar.
- El pipeline de integración continua falla en `main` o el Quality Gate de SonarCloud no se aprueba.
- Se detecta una vulnerabilidad crítica introducida por el cambio.

Mientras se revierte, la garita aplica el protocolo de contingencia (plantilla local y bitácora; CC-08 y CC-10):
la operación no se detiene y los movimientos se concilian después.

## Cómo se revierte

| Capa | Procedimiento | Tiempo estimado |
|---|---|---|
| SPA (Vercel) | Panel de Vercel → *Deployments* → despliegue de la versión estable → *Promote to Production* (*Instant Rollback*) | 1–2 min |
| API (Render) | Panel de Render → servicio de la API → *Events* → despliegue de la versión estable → *Rollback* | 3–5 min |
| Código | `git revert` del cambio en una rama, PR y fusión tras el CI; el pipeline vuelve a desplegar | 10–15 min |
| Base de datos (Supabase) | Las migraciones solo avanzan (`V001`–`V007`); un cambio de esquema se revierte con una migración nueva. Ante pérdida o corrupción de datos, se restaura el respaldo diario cifrado en una instancia nueva, según el procedimiento probado el 13/10/2026 (Práctica 06), y se concilian los movimientos posteriores al respaldo desde la plantilla de la garita | 30–60 min |

Las mejoras de la captura biométrica (control de calidad, captura automática e iluminación) solo cambian la SPA:
revertirlas no requiere tocar la API ni la base de datos.

## Verificación posterior

1. Consultar por QR la bicicleta de prueba y registrar un ingreso de prueba en un entorno de prueba, o comprobar la
   consulta en el piloto (modo de solo lectura de las pruebas E2E).
2. Ejecutar un retiro con verificación facial del titular de prueba.
3. Revisar en Monitoreo que los movimientos del día se muestran y que no hay contingencias pendientes sin conciliar.
4. Registrar la reversión en el Plan y Registro de Gestión y Control de Cambios, con la causa y la versión restaurada.

## Responsables

- Decide la reversión: el equipo del proyecto, con aviso al asesor y a la Jefatura de Seguridad.
- Ejecuta la reversión de la SPA y de la API: Rodrigo Gómez Fernández.
- Restaura la base de datos, si fuera necesario: Christian Romero Bejarano, con la clave de respaldo custodiada por el equipo.
