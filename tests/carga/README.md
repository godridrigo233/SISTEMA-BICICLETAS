# Prueba de Carga para RNF-01 con k6

Módulo de pruebas de carga automatizadas con **k6** para evaluar el **Requerimiento No Funcional RNF-01** (tiempo de respuesta del sistema inferior a 2 segundos) sobre la API REST del **Sistema de Control de Accesos de Bicicletas UCSM**.

> [!IMPORTANT]
> **Aclaración sobre la medición de latencia:**
> Esta prueba de carga con k6 mide estrictamente el **tiempo de respuesta del servidor (API REST)** ante la concurrencia en garita.
> El **tiempo total del proceso de retiro** —que comprende la extracción del descriptor facial de 128 dimensiones en el navegador del cliente mediante Edge Computing (con WebGL / face-api.js) más el viaje de red y la decisión 1:1 en el servidor— se monitorea y audita de manera integral a través de la columna `latencia_ms` en la tabla `auditoria_accesos`.

> [!CAUTION]
> **Seguridad y Protección del Entorno Piloto (`K6_PERMITIR_ESCRITURA`):**
> El entorno desplegado en producción/staging corresponde al piloto real y la tabla `auditoria_accesos` está configurada como de **solo inserción** (no se pueden eliminar ni modificar registros históricos).
> - Por defecto, la prueba opera en **SOLO LECTURA** (`K6_PERMITIR_ESCRITURA="false"`), evaluando la consulta de bicicletas por código QR (`GET /api/v1/bicicletas/{codigoQr}`).
> - El valor `"true"` activa la escritura (`POST /api/v1/ingresos/registrar`) y **SOLO debe utilizarse contra una base de datos de prueba desechable, NUNCA contra el piloto real**.

---

## Parámetros de Diseño de la Prueba

| Parámetro | Configuración | Justificación |
|---|---|---|
| **Calentamiento (`setup`)** | `GET /health` | Despierta la instancia en reposo de Render antes de iniciar la medición |
| **Autenticación (`setup`)** | `POST /api/v1/auth/login` único | Obtiene el token JWT una sola vez; previene el bloqueo de la cuenta institucional (política de seguridad: máx. 5 intentos fallidos) |
| **Carga concurrente** | 10 Usuarios Virtuales (VUs) | Simula la concurrencia simultánea en garitas |
| **Duración** | 2 minutos (`2m`) | Permite estabilizar las mediciones de latencia percentil |
| **Pausa (`sleep`)** | 1 segundo entre iteraciones | Modela el intervalo humano habitual en la atención de garita |
| **Umbral de latencia** | `p(95) < 2000 ms` | Criterio de aceptación estricto para el RNF-01 |
| **Umbral de fallos** | `rate < 0.01` (errores < 1 %) | Asegura alta disponibilidad operativa |

---

## Variables de Entorno

Las credenciales y direcciones nunca se versionan en el repositorio. Se configuran mediante variables de entorno en local o secretos en GitHub Actions:

| Variable | Descripción | Valor por defecto (Local) |
|---|---|---|
| `K6_BASE_URL` | URL base de la API REST desplegada | `http://localhost:5000` |
| `K6_CORREO` | Correo institucional del operador de garita | *(Obligatorio)* |
| `K6_PASSWORD` | Contraseña institucional del operador | *(Obligatoria)* |
| `K6_CODIGO_QR` | Código QR (UUID) de la bicicleta de prueba | Registro sintético S001 |
| `K6_PERMITIR_ESCRITURA` | Habilita mutaciones (`true`/`false`) | `"false"` (Solo lectura) |

---

## Ejecución Local

1. Instalar k6:
   - **macOS (Homebrew)**: `brew install k6`
   - **Linux (Debian/Ubuntu)**:
     ```bash
     sudo gpg -k
     sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
     echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
     sudo apt-get update && sudo apt-get install k6
     ```
   - **Windows**: `choco install k6` o `winget install k6`

2. Ejecutar la prueba en modo solo lectura:
   ```bash
   K6_BASE_URL="https://tu-api.onrender.com" \
   K6_CORREO="operador.garita@ucsm.edu.pe" \
   K6_PASSWORD="tu-password-segura" \
   K6_CODIGO_QR="b0000000-0000-4000-8000-0000000000a1" \
   K6_PERMITIR_ESCRITURA="false" \
   k6 run tests/carga/rnf01-carga.js
   ```

3. Los resultados se guardarán automáticamente en:
   - `tests/carga/resultados/resumen.md`
   - `tests/carga/resultados/resumen.json`

---

## Ejecución en GitHub Actions

El repositorio cuenta con el flujo de trabajo manual `.github/workflows/carga.yml` (`workflow_dispatch`).

Para dispararlo:
1. Ir a la pestaña **Actions** en el repositorio de GitHub.
2. Seleccionar el flujo **Prueba de Carga RNF-01 (k6)**.
3. Presionar **Run workflow**.
   - `base_url`: (opcional) URL base de la API.
   - `permitir_escritura`: (booleano, por defecto `false`). **Debe mantenerse en `false` contra el piloto real**.
4. Al concluir, el reporte consolidado (`resumen.md` y `resumen.json`) se publicará como el artefacto descargable `resumen-prueba-carga-rnf01`.

---

## Interpretación de Resultados

Al finalizar, el reporte consolidado evalúa el cumplimiento de las metas del RNF-01:
- **Percentil 95 (`p95`)**: El 95 % de las solicitudes debieron responder en menos de 2000 ms. Si `p95 < 2000 ms`, el criterio de latencia se marca como **Aprobado**.
- **Tasa de error**: Proporción de solicitudes fallidas (`status !== 200`). Debe ser estrictamente menor al 1.00 %.
- **Media y Mediana**: Permiten contrastar si existen dispersiones o colas largas causadas por el arranque en frío o bloqueos en la base de datos.
