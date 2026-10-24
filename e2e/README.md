# Pruebas de Extremo a Extremo (E2E) con Playwright

Suite automatizada de pruebas end-to-end para el **Sistema de Control de Accesos de Bicicletas UCSM**, diseñada para validar el comportamiento del sistema desplegado en el entorno de staging (Render + Vercel) o en desarrollo local.

> [!IMPORTANT]
> **Protección de Datos y Secretos:**
> Las credenciales y URLs **nunca** se versionan en el código ni en archivos de este repositorio. Se configuran mediante variables de entorno en el equipo local o mediante **GitHub Secrets / Variables** en GitHub Actions. No se prueba la verificación facial biométrica en esta suite (requiere cámara y presencia física).

---

## Escenarios Cubiertos

1. **`01-login-roles.spec.js`**: Autenticación y redirección inicial por rol según la matriz de navegación (Estudiante a `/estudiante/historial`, Garitero a `/garita/control-acceso`, Supervisor a `/garita/control-acceso`, Administrador a `/gestion/monitoreo`).
2. **`02-control-acceso-rbac.spec.js`**: Barrera de navegación por roles (RBAC) y redirección inmediata con mensaje formal `No tiene permiso para acceder a esa pantalla (403).`.
3. **`03-garita-ingreso.spec.js`**: Operación en garita: búsqueda por código QR digitado de una bicicleta de prueba y registro de ingreso (`FUERA` → `DENTRO`), con actualización en tiempo real de los últimos movimientos.
4. **`04-contingencias-csv.spec.js`**: Consola de Regularización: importación de plantilla CSV de garita con validación automática previa y conciliación en lote tras confirmación única.
5. **`05-monitoreo-reportes.spec.js`**: Panel de monitoreo: verificación de KPIs, aplicación de filtros de auditoría y descarga de reporte en formato CSV generado por la API.

---

## Variables de Entorno

| Variable | Descripción | Valor por defecto (Local) |
|---|---|---|
| `E2E_BASE_URL` | URL base de la aplicación web en staging o local | `http://localhost:5173` |
| `E2E_ESTUDIANTE_EMAIL` | Correo institucional del usuario Estudiante de prueba | — |
| `E2E_ESTUDIANTE_PASSWORD` | Contraseña del usuario Estudiante | — |
| `E2E_GARITERO_EMAIL` | Correo institucional del usuario Garitero de prueba | — |
| `E2E_GARITERO_PASSWORD` | Contraseña del usuario Garitero | — |
| `E2E_SUPERVISOR_EMAIL` | Correo institucional del usuario Supervisor de prueba | — |
| `E2E_SUPERVISOR_PASSWORD` | Contraseña del usuario Supervisor | — |
| `E2E_ADMIN_EMAIL` | Correo institucional del Administrador | — |
| `E2E_ADMIN_PASSWORD` | Contraseña del Administrador | — |
| `E2E_BICICLETA_QR` | Código QR (UUID) de la bicicleta de prueba | Registro sintético S001 |
| `E2E_VIGILANTE_EMAIL` | Correo del vigilante para registro en contingencias | `E2E_GARITERO_EMAIL` |

> [!NOTE]
> Si no se definen las credenciales para un rol específico durante una ejecución local, la prueba correspondiente se omitirá de forma limpia indicando qué variable falta.

---

## Ejecución Local

1. Instalar dependencias del módulo E2E:
   ```bash
   cd e2e
   npm install
   npx playwright install --with-deps chromium
   ```

2. Ejecutar las pruebas:
   ```bash
   # Con variables inline
   E2E_BASE_URL="https://staging.tu-dominio.com" \
   E2E_ESTUDIANTE_EMAIL="seed.alumno1@estudiante.ucsm.edu.pe" \
   E2E_ESTUDIANTE_PASSWORD="tu-password" \
   E2E_GARITERO_EMAIL="seed.garita1@ucsm.edu.pe" \
   E2E_GARITERO_PASSWORD="tu-password" \
   E2E_SUPERVISOR_EMAIL="seed.supervisor@ucsm.edu.pe" \
   E2E_SUPERVISOR_PASSWORD="tu-password" \
   E2E_ADMIN_EMAIL="seed.admin@ucsm.edu.pe" \
   E2E_ADMIN_PASSWORD="tu-password" \
   npm test
   ```

3. Visualizar el reporte HTML:
   ```bash
   npm run report
   ```

---

## Ejecución en GitHub Actions

El repositorio cuenta con el flujo de trabajo manual `.github/workflows/e2e.yml` (`workflow_dispatch`).

Para dispararlo:
1. Ir a la pestaña **Actions** en GitHub.
2. Seleccionar el workflow **Pruebas E2E (Playwright)**.
3. Presionar **Run workflow** (opcionalmente ingresando una URL de staging personalizada).
4. Al finalizar la ejecución, el **reporte HTML** estará disponible para su descarga en la sección de artefactos (`reporte-playwright`).
