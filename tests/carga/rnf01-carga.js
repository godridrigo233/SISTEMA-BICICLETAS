import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Prueba de carga con k6 para validar el RNF-01 (tiempo de respuesta del servidor < 2 s).
 *
 * MODO DE OPERACIÓN:
 * - Por defecto es de SOLO LECTURA (K6_PERMITIR_ESCRITURA="false"), midiendo únicamente GET /api/v1/bicicletas/{codigoQr}.
 * - Si K6_PERMITIR_ESCRITURA="true", agrega POST /api/v1/ingresos/registrar.
 *   PRECAUCIÓN: true solo debe utilizarse contra una base de datos de prueba desechable, NUNCA contra el piloto real.
 *
 * CREDENCIALES Y VARIABLES (nunca valores reales en el código):
 * - K6_BASE_URL: URL base de la API (ej. https://staging-api.onrender.com).
 * - K6_CORREO: Correo institucional del operador de garita.
 * - K6_PASSWORD: Contraseña institucional.
 * - K6_CODIGO_QR: UUID de la bicicleta de prueba.
 * - K6_PERMITIR_ESCRITURA: "true" o "false" (default: "false").
 */

const permitirEscritura = String(__ENV.K6_PERMITIR_ESCRITURA || 'false').toLowerCase() === 'true';

// Configuración de umbrales aplicados exclusivamente a las solicitudes medidas
const thresholdsConfig = {
  'http_req_duration{escenario:consulta}': ['p(95)<2000'],
  'http_req_failed{escenario:consulta}': ['rate<0.01'],
};

if (permitirEscritura) {
  thresholdsConfig['http_req_duration{escenario:ingreso}'] = ['p(95)<2000'];
  thresholdsConfig['http_req_failed{escenario:ingreso}'] = ['rate<0.01'];
}

export const options = {
  vus: 10,
  duration: '2m',
  thresholds: thresholdsConfig,
};

/**
 * Fase de preparación (setup):
 * 1. Ejecuta un GET /health de calentamiento (evita fallos si la instancia en Render estaba en reposo).
 * 2. Realiza un ÚNICO inicio de sesión (POST /api/v1/auth/login) para obtener el token JWT.
 *    No se reintenta por iteración para evitar el bloqueo de la cuenta institucional (máx. 5 intentos fallidos).
 */
export function setup() {
  const baseUrl = (__ENV.K6_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
  const correo = __ENV.K6_CORREO;
  const password = __ENV.K6_PASSWORD;
  const codigoQr = __ENV.K6_CODIGO_QR || 'b0000000-0000-4000-8000-0000000000a1';

  if (!correo || !password) {
    throw new Error('Variables de entorno obligatorias no definidas: especifique K6_CORREO y K6_PASSWORD.');
  }

  // 1. Calentamiento de la API
  const resHealth = http.get(`${baseUrl}/health`, {
    timeout: '60s',
    tags: { fase: 'calentamiento' },
  });

  check(resHealth, {
    'health check respondio': (r) => r.status === 200 || r.status === 503,
  });

  // 2. Autenticación única para obtener el JWT institucional
  const payloadLogin = JSON.stringify({
    correo: correo.trim(),
    password: password,
  });

  const resLogin = http.post(`${baseUrl}/api/v1/auth/login`, payloadLogin, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
    tags: { fase: 'login_setup' },
  });

  if (resLogin.status !== 200) {
    throw new Error(`Fallo de autenticación en setup (${resLogin.status}): ${resLogin.body}`);
  }

  const jsonLogin = resLogin.json();
  const token = jsonLogin?.token;

  if (!token) {
    throw new Error('La respuesta de /api/v1/auth/login no contiene el token JWT esperado.');
  }

  let idBicicleta = null;
  if (permitirEscritura) {
    const resBici = http.get(`${baseUrl}/api/v1/bicicletas/${encodeURIComponent(codigoQr)}`, {
      headers: { Authorization: `Bearer ${token}` },
      tags: { fase: 'bici_setup' },
    });
    if (resBici.status === 200) {
      idBicicleta = resBici.json()?.idBicicleta;
    }
  }

  return {
    baseUrl,
    token,
    codigoQr,
    permitirEscritura,
    idBicicleta,
  };
}

/**
 * Escenario de ejecución: 10 VUs durante 2 minutos.
 * Simula el ritmo operativo de garita con una pausa de 1 segundo entre iteraciones.
 */
export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // 1. Medición de consulta por código QR (GET /api/v1/bicicletas/{codigoQr})
  const urlConsulta = `${data.baseUrl}/api/v1/bicicletas/${encodeURIComponent(data.codigoQr)}`;
  const resConsulta = http.get(urlConsulta, {
    headers,
    tags: { escenario: 'consulta' },
  });

  check(resConsulta, {
    'consulta status es 200': (r) => r.status === 200,
    'consulta responde en < 2000 ms': (r) => r.timings.duration < 2000,
  });

  // 2. Operación de escritura opcional: solo si K6_PERMITIR_ESCRITURA="true"
  if (data.permitirEscritura) {
    const idBicicleta = data.idBicicleta || (resConsulta.status === 200 ? resConsulta.json()?.idBicicleta : null);
    if (idBicicleta) {
      const payloadIngreso = JSON.stringify({
        idBicicleta: idBicicleta,
        latenciaMs: Math.round(resConsulta.timings.duration),
      });

      const resIngreso = http.post(`${data.baseUrl}/api/v1/ingresos/registrar`, payloadIngreso, {
        headers,
        tags: { escenario: 'ingreso' },
      });

      check(resIngreso, {
        'ingreso status procesado (200 o 409)': (r) => r.status === 200 || r.status === 409,
        'ingreso responde en < 2000 ms': (r) => r.timings.duration < 2000,
      });
    }
  }

  // Simulación del intervalo de llegada en garita
  sleep(1);
}

/**
 * Genera el reporte de resumen en Markdown y JSON con las métricas solicitadas.
 */
export function handleSummary(data) {
  const metricaDuracionConsulta = data.metrics['http_req_duration{escenario:consulta}'] || data.metrics['http_req_duration'];
  const metricaFalloConsulta = data.metrics['http_req_failed{escenario:consulta}'] || data.metrics['http_req_failed'];
  const metricaReqsConsulta = data.metrics['http_reqs{escenario:consulta}'] || data.metrics['http_reqs'];

  const numeroSolicitudes = metricaReqsConsulta?.values?.count || metricaDuracionConsulta?.values?.count || 0;
  const tasaError = Number(((metricaFalloConsulta?.values?.rate || 0) * 100).toFixed(2));
  const mediaMs = Number((metricaDuracionConsulta?.values?.avg || 0).toFixed(2));
  const medianaMs = Number((metricaDuracionConsulta?.values?.med || 0).toFixed(2));
  const p90Ms = Number((metricaDuracionConsulta?.values?.['p(90)'] || 0).toFixed(2));
  const p95Ms = Number((metricaDuracionConsulta?.values?.['p(95)'] || 0).toFixed(2));
  const maximoMs = Number((metricaDuracionConsulta?.values?.max || 0).toFixed(2));

  const cumpleRnf01 = p95Ms < 2000 && tasaError < 1.0;

  const resumenJson = {
    escenario: 'consulta_bicicleta_qr',
    rnf: 'RNF-01 (tiempo de respuesta del servidor < 2000 ms)',
    fechaGeneracion: new Date().toISOString(),
    metricas: {
      numeroSolicitudes,
      tasaErrorPorcentaje: tasaError,
      mediaMs,
      medianaMs,
      p90Ms,
      p95Ms,
      maximoMs,
    },
    cumpleRnf01,
  };

  if (data.metrics['http_req_duration{escenario:ingreso}']) {
    const durIngreso = data.metrics['http_req_duration{escenario:ingreso}'];
    const failIngreso = data.metrics['http_req_failed{escenario:ingreso}'];
    const reqsIngreso = data.metrics['http_reqs{escenario:ingreso}'];

    resumenJson.escenarioIngreso = {
      numeroSolicitudes: reqsIngreso?.values?.count || durIngreso?.values?.count || 0,
      tasaErrorPorcentaje: Number(((failIngreso?.values?.rate || 0) * 100).toFixed(2)),
      mediaMs: Number((durIngreso?.values?.avg || 0).toFixed(2)),
      medianaMs: Number((durIngreso?.values?.med || 0).toFixed(2)),
      p90Ms: Number((durIngreso?.values?.['p(90)'] || 0).toFixed(2)),
      p95Ms: Number((durIngreso?.values?.['p(95)'] || 0).toFixed(2)),
      maximoMs: Number((durIngreso?.values?.max || 0).toFixed(2)),
    };
  }

  const resumenMd = `# Resumen de Prueba de Carga — RNF-01 (k6)

- **Fecha de ejecución**: ${resumenJson.fechaGeneracion}
- **Escenario medido**: \`GET /api/v1/bicicletas/{codigoQr}\` (\`escenario:consulta\`)
- **Criterio RNF-01**: percentil 95 (p95) < 2000 ms y tasa de error < 1.00 %
- **Resultado de evaluación**: **${cumpleRnf01 ? 'CUMPLE (Aprobado)' : 'NO CUMPLE (Desaprobado)'}**

## Tabla de Métricas Consolidadas

| Métrica | Valor Obtenido | Criterio de Aceptación | Estado |
|---|---|---|---|
| **Número de solicitudes** | ${numeroSolicitudes} | — | — |
| **Tasa de error** | ${tasaError} % | < 1.00 % | ${tasaError < 1.0 ? '✓ Aprobado' : '✗ Fallido'} |
| **Media (Promedio)** | ${mediaMs} ms | — | — |
| **Mediana** | ${medianaMs} ms | — | — |
| **Percentil 90 (p90)** | ${p90Ms} ms | — | — |
| **Percentil 95 (p95)** | ${p95Ms} ms | < 2000 ms | ${p95Ms < 2000 ? '✓ Aprobado' : '✗ Fallido'} |
| **Tiempo Máximo** | ${maximoMs} ms | — | — |

> Nota: Esta medición evalúa el tiempo de respuesta del servidor (API REST). El tiempo total del retiro (extracción facial en el navegador + decisión de la API) se registra en la columna \`latencia_ms\` de la tabla \`auditoria_accesos\`.
`;

  return {
    'tests/carga/resultados/resumen.json': JSON.stringify(resumenJson, null, 2),
    'tests/carga/resultados/resumen.md': resumenMd,
    stdout: `\n=== RESUMEN PRUEBA DE CARGA RNF-01 ===\nSolicitudes: ${numeroSolicitudes}\np(95): ${p95Ms} ms (Umbral: < 2000 ms)\nTasa error: ${tasaError} % (Umbral: < 1.00 %)\nResultado: ${cumpleRnf01 ? 'CUMPLE' : 'NO CUMPLE'}\n=======================================\n`,
  };
}
