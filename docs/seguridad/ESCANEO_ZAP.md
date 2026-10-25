# Escaneo de Seguridad — OWASP ZAP Baseline

## Descripción

El workflow **Seguridad – OWASP ZAP Baseline** ejecuta un escaneo pasivo
(sin autenticación ni escrituras) contra la SPA y la API desplegadas del
sistema de bicicletas. Utiliza
[OWASP ZAP](https://www.zaproxy.org/) a través de la acción
[`zaproxy/action-baseline`](https://github.com/zaproxy/action-baseline).

> [!NOTE]
> El escaneo es **pasivo**: no envía credenciales, no realiza escrituras
> y no modifica datos en el entorno objetivo.

---

## Cómo ejecutarlo

1. Ir a la pestaña **Actions** del repositorio en GitHub.
2. Seleccionar el workflow **Seguridad – OWASP ZAP Baseline** en el panel
   izquierdo.
3. Hacer clic en **Run workflow** (rama `main` o la rama deseada).
4. Esperar a que finalicen los dos jobs (`zap-spa` y `zap-api`).

### Variables requeridas

Opcionalmente, configurar las siguientes **variables de repositorio** (también se aceptan como secretos); si no existen, se usan las URL públicas del piloto (_Settings → Secrets and variables → Actions → Variables_):

| Variable        | Descripción                          | Ejemplo                             |
| --------------- | ------------------------------------ | ----------------------------------- |
| `ZAP_URL_SPA`   | URL pública de la SPA desplegada (opcional) | `https://sistema-bicicletas.vercel.app` (por defecto) |
| `ZAP_URL_API`   | URL pública de la API desplegada (opcional) | `https://sistema-bicicletas.onrender.com` (por defecto) |

---

## Cómo leer el reporte

Cada ejecución genera tres artefactos por objetivo (SPA y API):

| Artefacto            | Formato  | Uso principal                                         |
| -------------------- | -------- | ----------------------------------------------------- |
| `report_html.html`   | HTML     | Reporte visual completo; abrir en el navegador.       |
| `report_json.json`   | JSON     | Procesamiento automatizado o integración con dashboards.|
| `report_md.md`       | Markdown | Resumen rápido; se puede incluir en documentación.    |

### Secciones clave del reporte HTML

- **Summary of Alerts**: tabla resumen con cantidad de alertas por severidad
  (Alta, Media, Baja, Informativa).
- **Alert Detail**: detalle de cada alerta con la URL afectada, descripción,
  solución propuesta y referencia CWE/WASC.

> [!TIP]
> Descargue los artefactos desde la pestaña **Actions → ejecución → Artifacts**
> (retención: 14 días).

---

## Archivo de reglas

El archivo [`.zap/reglas.tsv`](../../.zap/reglas.tsv) permite documentar
falsos positivos justificados y riesgos aceptados. Formato de cada línea:

```
<ID_ALERTA>	<IGNORE|WARN|FAIL>	<Justificación>
```

> [!IMPORTANT]
> Los hallazgos descartados con justificación técnica se registran con acción `IGNORE`
> para que las ejecuciones subsecuentes del Baseline Scan no reporten falsos positivos.

---

## Registro de hallazgos (Ejecución del 24/10/2026)

| ID de alerta | Nombre | Severidad | URL afectada | Corrección propuesta | Estado |
| ------------ | ------ | --------- | ------------ | -------------------- | ------ |
| **10038** | Content Security Policy (CSP) Header Not Set | Media | `https://sistema-bicicletas.vercel.app` | Configurar directiva CSP en `vercel.json` | Corregido (PR actual) |
| **10020** | Anti-clickjacking Header (X-Frame-Options) | Media | `https://sistema-bicicletas.vercel.app` | Agregar `X-Frame-Options: DENY` en `vercel.json` | Corregido (PR actual) |
| **10098** | Cross-Domain Misconfiguration | Media | `https://sistema-bicicletas.vercel.app` | Delimitar `Access-Control-Allow-Origin` al dominio de la SPA | Corregido (PR actual) |
| **10021** | X-Content-Type-Options Header Missing | Baja | `https://sistema-bicicletas.vercel.app` | Agregar `X-Content-Type-Options: nosniff` en `vercel.json` | Corregido (PR actual) |
| **10063** | Permissions Policy Header Not Set | Baja | `https://sistema-bicicletas.vercel.app` | Definir `Permissions-Policy` restringiendo cámara a `(self)` y resto desactivado | Corregido (PR actual) |
| **90004-3** | Insufficient Site Isolation Against Spectre (COOP) | Baja | `https://sistema-bicicletas.vercel.app` | Agregar `Cross-Origin-Opener-Policy: same-origin` en `vercel.json` | Corregido (PR actual) |
| **10035** | Strict-Transport-Security Header Not Set | Baja | `https://sistema-bicicletas.onrender.com` | Middleware global con `HSTS: max-age=31536000; includeSubDomains` en `Program.cs` | Corregido (PR actual) |
| **10049** | Storable and Cacheable Content | Baja | `https://sistema-bicicletas.onrender.com` | Middleware global con `Cache-Control: no-store` en `Program.cs` | Corregido (PR actual) |
| **90004-2** | Cross-Origin-Embedder-Policy (COEP) Header Not Set | Baja | `https://sistema-bicicletas.vercel.app` | Ninguna; se agrega regla `IGNORE` en `.zap/reglas.tsv` | Aceptado: puede bloquear recursos y la cámara; beneficio marginal |
| **10015** | Re-examine Cache-control Directives | Informativa | `https://sistema-bicicletas.vercel.app` | Contenido estático distribuido públicamente vía CDN | Informativo: contenido estático público, sin acción |
| **10050** | Retrieved from Cache | Informativa | `https://sistema-bicicletas.vercel.app` | Caché estándar de navegador y CDN para assets estáticos | Informativo: contenido estático público, sin acción |
| **10049-2** | Storable but Non-Cacheable Content | Informativa | `https://sistema-bicicletas.vercel.app` | Comportamiento estándar de recursos estáticos en CDN | Informativo: contenido estático público, sin acción |
| **10109** | Modern Web Application | Informativa | `https://sistema-bicicletas.vercel.app` | Notificación de arquitectura Single Page Application (SPA) | Informativo: contenido estático público, sin acción |

### Convención de estados

| Estado          | Significado                                                  |
| --------------- | ------------------------------------------------------------ |
| **Pendiente**   | Hallazgo identificado, aún no evaluado.                      |
| **En progreso** | Se está trabajando en la corrección.                         |
| **Corregido (PR actual)** | Corrección implementada mediante cabeceras de seguridad HTTP. |
| **Corregido**   | Corrección implementada y verificada en un escaneo posterior.|
| **Falso positivo** | Descartado con justificación; regla documentada en `reglas.tsv`.|
| **Aceptado**    | Riesgo aceptado formalmente con justificación documentada.   |
| **Informativo** | Alerta meramente informativa que no representa vulnerabilidad.|
