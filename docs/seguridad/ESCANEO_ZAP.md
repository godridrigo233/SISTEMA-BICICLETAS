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

Opcionalmente, configurar las siguientes **variables de repositorio** (también se aceptan como secretos); si no existen, se usan las URL públicas del piloto (_Settings → Secrets
and variables → Actions → Variables_):

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
falsos positivos justificados. Formato de cada línea:

```
<ID_ALERTA>	<IGNORE|WARN|FAIL>	<Justificación>
```

> [!IMPORTANT]
> En este PR inicial no se ignora ninguna regla. Los falsos positivos se
> registrarán tras analizar los resultados de la primera ejecución.

---

## Registro de hallazgos

La siguiente tabla se completará tras la primera ejecución del escaneo.

| ID de alerta | Nombre | Severidad | URL afectada | Corrección propuesta | Estado |
| ------------ | ------ | --------- | ------------ | -------------------- | ------ |
|              |        |           |              |                      |        |

### Convención de estados

| Estado          | Significado                                                  |
| --------------- | ------------------------------------------------------------ |
| **Pendiente**   | Hallazgo identificado, aún no evaluado.                      |
| **En progreso** | Se está trabajando en la corrección.                         |
| **Corregido**   | Corrección implementada y verificada en un escaneo posterior.|
| **Falso positivo** | Descartado con justificación; regla documentada en `reglas.tsv`.|
| **Aceptado**    | Riesgo aceptado formalmente con justificación documentada.   |
