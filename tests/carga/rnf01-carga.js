import http from 'k6/http';
import exec from 'k6/execution';
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
 *
 * MODOS (K6_MODO):
 * - "carga" (por defecto): 10 VUs durante 2 minutos; verifica el RNF-01 con la carga operativa de la garita.
 * - "escalonada": sube los VUs por niveles (K6_NIVELES, por defecto 10,25,50,100,150). Cada nivel tiene una rampa
 *   (K6_RAMPA_S, 60 s) y una meseta (K6_MESETA_S, 120 s); solo se miden las solicitudes de la meseta. El resumen
 *   indica la capacidad máxima: el mayor nivel que, junto con todos los anteriores, mantiene p95 < 2000 ms y
 *   errores < 1 %. Es SIEMPRE de solo lectura (ignora K6_PERMITIR_ESCRITURA) y se detiene sola si los errores
 *   superan el 30 % o el p95 acumulado supera los 10 s, para no dejar sin servicio al piloto.
 */

const modo = String(__ENV.K6_MODO || 'carga').trim().toLowerCase();
const escalonada = modo === 'escalonada';
if (!['carga', 'escalonada'].includes(modo)) {
  throw new Error(`K6_MODO no válido: "${modo}". Use "carga" o "escalonada".`);
}

const permitirEscritura = !escalonada && String(__ENV.K6_PERMITIR_ESCRITURA || 'false').toLowerCase() === 'true';

const NIVELES = String(__ENV.K6_NIVELES || '10,25,50,100,150')
  .split(',')
  .map((n) => Number.parseInt(n.trim(), 10))
  .filter((n) => Number.isInteger(n) && n > 0);
const RAMPA_S = Number.parseInt(__ENV.K6_RAMPA_S || '60', 10);
const MESETA_S = Number.parseInt(__ENV.K6_MESETA_S || '120', 10);
if (escalonada && (NIVELES.length === 0 || !(RAMPA_S > 0) || !(MESETA_S > 0))) {
  throw new Error('Configuración escalonada no válida: revise K6_NIVELES, K6_RAMPA_S y K6_MESETA_S.');
}

// Configuración de umbrales aplicados exclusivamente a las solicitudes medidas
const thresholdsConfig = {
  'http_req_duration{escenario:consulta}': ['p(95)<2000'],
  'http_req_failed{escenario:consulta}': ['rate<0.01'],
  // Submétrica solo para contar las solicitudes medidas (excluye el calentamiento y el login de setup)
  'http_reqs{escenario:consulta}': ['count>0'],
};

if (permitirEscritura) {
  thresholdsConfig['http_req_duration{escenario:ingreso}'] = ['p(95)<2000'];
  thresholdsConfig['http_req_failed{escenario:ingreso}'] = ['rate<0.01'];
  thresholdsConfig['http_reqs{escenario:ingreso}'] = ['count>0'];
}

if (escalonada) {
  // Corte de seguridad: detiene la prueba si el servicio se degrada claramente.
  thresholdsConfig['http_req_failed{escenario:consulta}'] = [{ threshold: 'rate<0.30', abortOnFail: true, delayAbortEval: '30s' }];
  thresholdsConfig['http_req_duration{escenario:consulta}'] = [{ threshold: 'p(95)<10000', abortOnFail: true, delayAbortEval: '30s' }];
  // Submétricas por nivel (solo meseta). Los umbrales siempre se cumplen: existen para que k6 calcule cada nivel;
  // el criterio RNF-01 por nivel se evalúa en el resumen.
  for (const nivel of NIVELES) {
    thresholdsConfig[`http_req_duration{nivel:${nivel}}`] = ['max>=0'];
    thresholdsConfig[`http_req_failed{nivel:${nivel}}`] = ['rate>=0'];
    thresholdsConfig[`http_reqs{nivel:${nivel}}`] = ['count>=0'];
  }
}

const etapasEscalonadas = () => [
  ...NIVELES.flatMap((nivel) => [
    { duration: `${RAMPA_S}s`, target: nivel },
    { duration: `${MESETA_S}s`, target: nivel },
  ]),
  { duration: '30s', target: 0 },
];

export const options = escalonada
  ? {
    scenarios: {
      escalonada: { executor: 'ramping-vus', startVUs: 0, stages: etapasEscalonadas(), gracefulRampDown: '10s' },
    },
    thresholds: thresholdsConfig,
  }
  : {
    vus: 10,
    duration: '2m',
    thresholds: thresholdsConfig,
  };

/** Nivel de VUs en curso si el instante cae en la meseta de un nivel; 'rampa' en otro caso. */
function nivelActual() {
  const segundos = (Date.now() - exec.scenario.startTime) / 1000;
  const ciclo = RAMPA_S + MESETA_S;
  const indice = Math.floor(segundos / ciclo);
  if (indice < 0 || indice >= NIVELES.length) return 'rampa';
  return segundos - indice * ciclo >= RAMPA_S ? String(NIVELES[indice]) : 'rampa';
}

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
 * Escenario de ejecución: 10 VUs durante 2 minutos (modo "carga") o niveles crecientes (modo "escalonada").
 * Simula el ritmo operativo de garita con una pausa de 1 segundo entre iteraciones.
 */
export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // 1. Medición de consulta por código QR (GET /api/v1/bicicletas/{codigoQr})
  const urlConsulta = `${data.baseUrl}/api/v1/bicicletas/${encodeURIComponent(data.codigoQr)}`;
  const resConsulta = http.get(urlConsulta, escalonada
    ? { headers, tags: { escenario: 'consulta', nivel: nivelActual() }, timeout: '10s' }
    : { headers, tags: { escenario: 'consulta' } });

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
        // Tras el primer ingreso la bicicleta queda DENTRO y la API responde 409 (regla de negocio esperada),
        // por lo que 409 no se cuenta como error de disponibilidad.
        responseCallback: http.expectedStatuses(200, 409),
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

const redondear = (valor) => Number((valor || 0).toFixed(2));

/** Resumen de la prueba escalonada: métricas por nivel y capacidad máxima que cumple el RNF-01. */
function resumenEscalonado(data) {
  const niveles = NIVELES.map((vus) => {
    const duracion = data.metrics[`http_req_duration{nivel:${vus}}`]?.values;
    const fallos = data.metrics[`http_req_failed{nivel:${vus}}`]?.values;
    const solicitudes = data.metrics[`http_reqs{nivel:${vus}}`]?.values?.count || 0;
    if (!solicitudes) return { vus, alcanzado: false, cumpleRnf01: false };
    const p95Ms = redondear(duracion?.['p(95)']);
    const tasaErrorPorcentaje = redondear((fallos?.rate || 0) * 100);
    return {
      vus,
      alcanzado: true,
      solicitudes,
      solicitudesPorSegundo: redondear(solicitudes / MESETA_S),
      mediaMs: redondear(duracion?.avg),
      p90Ms: redondear(duracion?.['p(90)']),
      p95Ms,
      maximoMs: redondear(duracion?.max),
      tasaErrorPorcentaje,
      cumpleRnf01: p95Ms < 2000 && tasaErrorPorcentaje < 1.0,
    };
  });

  let capacidadMaximaVus = 0;
  for (const nivel of niveles) {
    if (!nivel.cumpleRnf01) break;
    capacidadMaximaVus = nivel.vus;
  }
  const primerIncumplimiento = niveles.find((n) => !n.cumpleRnf01);
  const limiteAlcanzado = Boolean(primerIncumplimiento?.alcanzado);
  const conclusion = capacidadMaximaVus === 0
    ? 'Ningún nivel cumple el RNF-01.'
    : limiteAlcanzado
      ? `La capacidad máxima que cumple el RNF-01 es de ${capacidadMaximaVus} usuarios concurrentes; con ${primerIncumplimiento.vus} se incumple.`
      : `Todos los niveles alcanzados cumplen el RNF-01: la capacidad es de al menos ${capacidadMaximaVus} usuarios concurrentes.`;

  const resumenJson = {
    escenario: 'consulta_bicicleta_qr_escalonada',
    rnf: 'RNF-01 (tiempo de respuesta del servidor < 2000 ms)',
    fechaGeneracion: new Date().toISOString(),
    configuracion: { niveles: NIVELES, rampaSegundos: RAMPA_S, mesetaSegundos: MESETA_S, pausaPorIteracionSegundos: 1 },
    niveles,
    capacidadMaximaVus,
    limiteAlcanzado,
    conclusion,
  };

  const filas = niveles.map((n) => (n.alcanzado
    ? `| ${n.vus} | ${n.solicitudes} | ${n.solicitudesPorSegundo} | ${n.mediaMs} ms | ${n.p95Ms} ms | ${n.maximoMs} ms | ${n.tasaErrorPorcentaje} % | ${n.cumpleRnf01 ? '✓ Cumple' : '✗ No cumple'} |`
    : `| ${n.vus} | — | — | — | — | — | — | No alcanzado (prueba detenida) |`)).join('\n');

  const resumenMd = `# Prueba de Carga Escalonada — RNF-01 (k6)

- **Fecha de ejecución**: ${resumenJson.fechaGeneracion}
- **Escenario medido**: \`GET /api/v1/bicicletas/{codigoQr}\` (solo lectura; consulta la API y la base de datos)
- **Niveles**: ${NIVELES.join(', ')} usuarios virtuales; rampa de ${RAMPA_S} s y meseta medida de ${MESETA_S} s por nivel; pausa de 1 s por iteración
- **Criterio RNF-01 por nivel**: p95 < 2000 ms y tasa de error < 1.00 %
- **Conclusión**: **${conclusion}**

| Usuarios (VU) | Solicitudes | Solicitudes/s | Media | p95 | Máximo | Error | RNF-01 |
|---|---|---|---|---|---|---|---|
${filas}

> Nota: Solo se miden las solicitudes de la meseta de cada nivel. Las solicitudes que superan 10 s se cuentan como error. La prueba se detiene sola si los errores superan el 30 % o el p95 acumulado supera los 10 s.
`;

  return {
    'tests/carga/resultados/resumen-escalonada.json': JSON.stringify(resumenJson, null, 2),
    'tests/carga/resultados/resumen-escalonada.md': resumenMd,
    stdout: `\n=== PRUEBA ESCALONADA RNF-01 ===\n${niveles.map((n) => (n.alcanzado
      ? `${n.vus} VU: p95 ${n.p95Ms} ms, error ${n.tasaErrorPorcentaje} % -> ${n.cumpleRnf01 ? 'CUMPLE' : 'NO CUMPLE'}`
      : `${n.vus} VU: no alcanzado`)).join('\n')}\n${conclusion}\n================================\n`,
  };
}

/**
 * Genera el reporte de resumen en Markdown y JSON con las métricas solicitadas.
 */
export function handleSummary(data) {
  if (escalonada) return resumenEscalonado(data);
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
