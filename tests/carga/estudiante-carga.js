import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';

/**
 * Prueba de carga con k6 del portal del ESTUDIANTE (complemento de rnf01-carga.js, que mide la garita).
 *
 * Cada usuario virtual simula a un estudiante que abre el sistema en bucle:
 *   1. POST /api/v1/auth/login            (escenario "login": verifica la contraseña con BCrypt, la operación más costosa)
 *   2. GET  /api/v1/estudiante/perfil      (escenario "perfil": sus datos y sus bicicletas con el código QR, base de «Ver mi QR»)
 *   3. GET  /api/v1/estudiante/historial   (escenario "historial": primera página de sus movimientos)
 *   4. pausa de 1 s
 * Es SIEMPRE de solo lectura: un inicio de sesión correcto no escribe en la base de datos.
 *
 * El RNF-01 se refiere a la respuesta al personal de vigilancia; para el estudiante se usa el mismo límite de 2 s
 * (p95 < 2000 ms y errores < 1 %) como referencia.
 *
 * VARIABLES (nunca valores reales en el código):
 * - K6_BASE_URL: URL base de la API.
 * - K6_CORREO_ESTUDIANTE, K6_PASSWORD_ESTUDIANTE: cuenta de PRUEBA con rol Estudiante y contraseña propia
 *   (no temporal). Se verifica una sola vez en setup: si falla, la prueba no empieza (evita el bloqueo por intentos).
 * - K6_MODO: "carga" (10 VUs durante 2 min) o "escalonada" (niveles K6_NIVELES, por defecto 5,10,25,50; rampa
 *   K6_RAMPA_S = 60 s y meseta medida K6_MESETA_S = 120 s por nivel). La escalonada se detiene sola si los errores
 *   superan el 30 % o el p95 acumulado supera los 10 s.
 */

const ESCENARIOS = ['login', 'perfil', 'historial'];
const NOMBRES = { login: 'Inicio de sesión', perfil: 'Perfil y QR', historial: 'Historial' };

const modo = String(__ENV.K6_MODO || 'carga').trim().toLowerCase();
if (!['carga', 'escalonada'].includes(modo)) {
  throw new Error(`K6_MODO no válido: "${modo}". Use "carga" o "escalonada".`);
}
const escalonada = modo === 'escalonada';

const NIVELES = String(__ENV.K6_NIVELES || '5,10,25,50')
  .split(',')
  .map((n) => Number.parseInt(n.trim(), 10))
  .filter((n) => Number.isInteger(n) && n > 0);
const RAMPA_S = Number.parseInt(__ENV.K6_RAMPA_S || '60', 10);
const MESETA_S = Number.parseInt(__ENV.K6_MESETA_S || '120', 10);
if (escalonada && (NIVELES.length === 0 || !(RAMPA_S > 0) || !(MESETA_S > 0))) {
  throw new Error('Configuración escalonada no válida: revise K6_NIVELES, K6_RAMPA_S y K6_MESETA_S.');
}

const thresholds = {};
if (escalonada) {
  // Corte de seguridad sobre todas las solicitudes medidas del estudiante.
  thresholds['http_req_failed{perfil:estudiante}'] = [{ threshold: 'rate<0.30', abortOnFail: true, delayAbortEval: '30s' }];
  thresholds['http_req_duration{perfil:estudiante}'] = [{ threshold: 'p(95)<10000', abortOnFail: true, delayAbortEval: '30s' }];
  // Submétricas por escenario y nivel (solo meseta). Siempre se cumplen: existen para que k6 calcule cada valor.
  for (const nivel of NIVELES) {
    for (const e of ESCENARIOS) {
      thresholds[`http_req_duration{escenario:${e},nivel:${nivel}}`] = ['max>=0'];
      thresholds[`http_req_failed{escenario:${e},nivel:${nivel}}`] = ['rate>=0'];
      thresholds[`http_reqs{escenario:${e},nivel:${nivel}}`] = ['count>=0'];
    }
  }
} else {
  for (const e of ESCENARIOS) {
    thresholds[`http_req_duration{escenario:${e}}`] = ['p(95)<2000'];
    thresholds[`http_req_failed{escenario:${e}}`] = ['rate<0.01'];
    thresholds[`http_reqs{escenario:${e}}`] = ['count>0'];
  }
}

export const options = escalonada
  ? {
    scenarios: {
      estudiante: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          ...NIVELES.flatMap((nivel) => [
            { duration: `${RAMPA_S}s`, target: nivel },
            { duration: `${MESETA_S}s`, target: nivel },
          ]),
          { duration: '30s', target: 0 },
        ],
        gracefulRampDown: '10s',
      },
    },
    thresholds,
  }
  : { vus: 10, duration: '2m', thresholds };

/** Nivel de VUs en curso si el instante cae en la meseta de un nivel; 'rampa' en otro caso. */
function nivelActual() {
  const segundos = (Date.now() - exec.scenario.startTime) / 1000;
  const ciclo = RAMPA_S + MESETA_S;
  const indice = Math.floor(segundos / ciclo);
  if (indice < 0 || indice >= NIVELES.length) return 'rampa';
  return segundos - indice * ciclo >= RAMPA_S ? String(NIVELES[indice]) : 'rampa';
}

export function setup() {
  const baseUrl = (__ENV.K6_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
  const correo = (__ENV.K6_CORREO_ESTUDIANTE || '').trim();
  const password = __ENV.K6_PASSWORD_ESTUDIANTE;

  if (!/^https?:\/\/[^\s/]+/i.test(baseUrl)) {
    throw new Error(`URL base no válida: "${baseUrl}". Deje vacío el campo base_url del workflow (usa el secreto K6_BASE_URL) o escriba la dirección completa.`);
  }
  if (!correo || !password) {
    throw new Error('Defina los secretos K6_CORREO_ESTUDIANTE y K6_PASSWORD_ESTUDIANTE (cuenta de prueba con rol Estudiante).');
  }

  http.get(`${baseUrl}/health`, { timeout: '60s', tags: { fase: 'calentamiento' } });

  // Verificación única de la cuenta: si falla, no se inicia la prueba (no se acumulan intentos fallidos).
  const res = http.post(`${baseUrl}/api/v1/auth/login`, JSON.stringify({ correo, password }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
    tags: { fase: 'verificacion' },
  });
  if (res.status !== 200) {
    throw new Error(`No se pudo iniciar sesión con la cuenta de estudiante de prueba (${res.status}). Revise los secretos.`);
  }
  const cuerpo = res.json();
  if (cuerpo?.idRol !== 1) {
    throw new Error('La cuenta K6_CORREO_ESTUDIANTE no tiene el rol Estudiante.');
  }
  if (cuerpo?.debeCambiarPassword) {
    throw new Error('La cuenta de estudiante de prueba tiene una contraseña temporal: cámbiela en el sistema antes de la prueba.');
  }
  return { baseUrl, correo, password };
}

export default function (data) {
  const nivel = escalonada ? nivelActual() : undefined;
  const etiquetas = (escenario) => (escalonada ? { perfil: 'estudiante', escenario, nivel } : { perfil: 'estudiante', escenario });
  const timeout = escalonada ? '10s' : '60s';

  const login = http.post(`${data.baseUrl}/api/v1/auth/login`, JSON.stringify({ correo: data.correo, password: data.password }), {
    headers: { 'Content-Type': 'application/json' },
    tags: etiquetas('login'),
    timeout,
  });
  const ok = check(login, { 'login status es 200': (r) => r.status === 200 });
  if (ok) {
    const params = (escenario) => ({ headers: { Authorization: `Bearer ${login.json('token')}` }, tags: etiquetas(escenario), timeout });
    check(http.get(`${data.baseUrl}/api/v1/estudiante/perfil`, params('perfil')), { 'perfil status es 200': (r) => r.status === 200 });
    check(http.get(`${data.baseUrl}/api/v1/estudiante/historial?pagina=1&tamano=10`, params('historial')), {
      'historial status es 200': (r) => r.status === 200,
    });
  }
  sleep(1);
}

const r2 = (v) => Number((v || 0).toFixed(2));

function medir(data, selector, segundos) {
  const d = data.metrics[`http_req_duration{${selector}}`]?.values;
  const f = data.metrics[`http_req_failed{${selector}}`]?.values;
  const solicitudes = data.metrics[`http_reqs{${selector}}`]?.values?.count || 0;
  const p95Ms = r2(d?.['p(95)']);
  const tasaErrorPorcentaje = r2((f?.rate || 0) * 100);
  return {
    solicitudes,
    solicitudesPorSegundo: segundos ? r2(solicitudes / segundos) : undefined,
    mediaMs: r2(d?.avg),
    p95Ms,
    maximoMs: r2(d?.max),
    tasaErrorPorcentaje,
    cumple: solicitudes > 0 && p95Ms < 2000 && tasaErrorPorcentaje < 1.0,
  };
}

const fila = (etiqueta, m) => (m.solicitudes
  ? `| ${etiqueta} | ${m.solicitudes} | ${m.solicitudesPorSegundo ?? '—'} | ${m.mediaMs} ms | ${m.p95Ms} ms | ${m.maximoMs} ms | ${m.tasaErrorPorcentaje} % | ${m.cumple ? '✓ Cumple' : '✗ No cumple'} |`
  : `| ${etiqueta} | — | — | — | — | — | — | No alcanzado |`);

export function handleSummary(data) {
  const fecha = new Date().toISOString();
  const encabezado = '| Nivel / operación | Solicitudes | Solicitudes/s | Media | p95 | Máximo | Error | Referencia 2 s |\n|---|---|---|---|---|---|---|---|';

  if (!escalonada) {
    const ops = Object.fromEntries(ESCENARIOS.map((e) => [e, medir(data, `escenario:${e}`, 120)]));
    const cumple = ESCENARIOS.every((e) => ops[e].cumple);
    const md = `# Prueba de Carga — Portal del Estudiante (k6)

- **Fecha de ejecución**: ${fecha}
- **Sesión simulada**: inicio de sesión → perfil y QR → historial, con pausa de 1 s; 10 usuarios virtuales durante 2 min; solo lectura
- **Referencia**: p95 < 2000 ms y error < 1.00 % en cada operación
- **Resultado**: **${cumple ? 'CUMPLE' : 'NO CUMPLE'}**

${encabezado}
${ESCENARIOS.map((e) => fila(NOMBRES[e], ops[e])).join('\n')}
`;
    return {
      'tests/carga/resultados/resumen-estudiante.json': JSON.stringify({ fecha, modo, operaciones: ops, cumple }, null, 2),
      'tests/carga/resultados/resumen-estudiante.md': md,
      stdout: `\n=== CARGA PORTAL DEL ESTUDIANTE ===\n${ESCENARIOS.map((e) => `${NOMBRES[e]}: p95 ${ops[e].p95Ms} ms, error ${ops[e].tasaErrorPorcentaje} %`).join('\n')}\nResultado: ${cumple ? 'CUMPLE' : 'NO CUMPLE'}\n===================================\n`,
    };
  }

  const niveles = NIVELES.map((vus) => {
    const ops = Object.fromEntries(ESCENARIOS.map((e) => [e, medir(data, `escenario:${e},nivel:${vus}`, MESETA_S)]));
    const alcanzado = ops.login.solicitudes > 0;
    return { vus, alcanzado, operaciones: ops, cumple: alcanzado && ESCENARIOS.every((e) => ops[e].cumple) };
  });
  let capacidadMaximaVus = 0;
  for (const n of niveles) {
    if (!n.cumple) break;
    capacidadMaximaVus = n.vus;
  }
  const primerFallo = niveles.find((n) => !n.cumple);
  const conclusion = capacidadMaximaVus === 0
    ? 'Ningún nivel cumple la referencia de 2 s.'
    : primerFallo?.alcanzado
      ? `El portal del estudiante mantiene la referencia de 2 s hasta ${capacidadMaximaVus} usuarios concurrentes; con ${primerFallo.vus} se incumple.`
      : `Todos los niveles alcanzados cumplen la referencia de 2 s: al menos ${capacidadMaximaVus} usuarios concurrentes.`;

  const filas = niveles.map((n) => ESCENARIOS.map((e) => fila(`${n.vus} VU · ${NOMBRES[e]}`, n.operaciones[e])).join('\n')).join('\n');
  const md = `# Prueba de Carga Escalonada — Portal del Estudiante (k6)

- **Fecha de ejecución**: ${fecha}
- **Sesión simulada**: inicio de sesión → perfil y QR → historial, con pausa de 1 s; solo lectura
- **Niveles**: ${NIVELES.join(', ')} usuarios virtuales; rampa de ${RAMPA_S} s y meseta medida de ${MESETA_S} s por nivel
- **Referencia por nivel**: p95 < 2000 ms y error < 1.00 % en las tres operaciones
- **Conclusión**: **${conclusion}**

${encabezado}
${filas}

> Nota: Solo se miden las solicitudes de la meseta de cada nivel. Las solicitudes que superan 10 s se cuentan como error. El inicio de sesión verifica la contraseña con BCrypt (costo 12), que es deliberadamente lento para resistir ataques de fuerza bruta.
`;
  return {
    'tests/carga/resultados/resumen-escalonada-estudiante.json': JSON.stringify({ fecha, modo, configuracion: { niveles: NIVELES, rampaSegundos: RAMPA_S, mesetaSegundos: MESETA_S }, niveles, capacidadMaximaVus, conclusion }, null, 2),
    'tests/carga/resultados/resumen-escalonada-estudiante.md': md,
    stdout: `\n=== ESCALONADA PORTAL DEL ESTUDIANTE ===\n${niveles.map((n) => (n.alcanzado
      ? `${n.vus} VU: ${ESCENARIOS.map((e) => `${e} p95 ${n.operaciones[e].p95Ms} ms (${n.operaciones[e].tasaErrorPorcentaje} %)`).join(' · ')} -> ${n.cumple ? 'CUMPLE' : 'NO CUMPLE'}`
      : `${n.vus} VU: no alcanzado`)).join('\n')}\n${conclusion}\n========================================\n`,
  };
}
