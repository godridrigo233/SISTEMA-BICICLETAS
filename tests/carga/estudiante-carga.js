import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';

/**
 * Prueba de carga con k6 del portal del ESTUDIANTE y de su efecto sobre la garita (RNF-01).
 *
 * Simula un uso realista: el estudiante inicia sesión UNA vez (el JWT dura 30 min) y luego navega. El inicio de
 * sesión, que verifica la contraseña con BCrypt (costo 12, lento a propósito), se mide aparte por ritmo de llegada.
 * Durante toda la prueba, una sonda simula 2 garitas consultando un QR por segundo cada una, para medir si la
 * actividad de los estudiantes degrada la operación crítica de la garita.
 *
 * MODO "escalonada" (dos fases, ≈ 14 min con los valores por defecto):
 *   Fase 1 · Navegación: sesiones abiertas (K6_NIVELES, por defecto 10,25,50 usuarios). Cada usuario inicia sesión
 *            una vez y luego, en bucle: perfil (bicicletas y código QR) → historial → pausa de 1 s.
 *   Fase 2 · Inicios de sesión: llegadas a ritmo fijo (K6_INICIOS_MIN, por defecto 15,30,60,120 por minuto).
 *   Cada nivel tiene una rampa (K6_RAMPA_S, 30 s) y una meseta medida (K6_MESETA_S, 90 s).
 * MODO "carga": 10 sesiones navegando durante 2 min, con la sonda de garita.
 *
 * Es SIEMPRE de solo lectura: un inicio de sesión correcto no escribe en la base de datos. Las solicitudes que
 * superan 10 s se cuentan como error. La prueba se detiene sola si la garita supera un p95 de 10 s o un 30 % de
 * errores, o si fallan más del 50 % de los inicios de sesión.
 *
 * VARIABLES (nunca valores reales en el código):
 * - K6_BASE_URL.
 * - K6_CORREO_ESTUDIANTE, K6_PASSWORD_ESTUDIANTE: cuenta de PRUEBA con rol Estudiante y contraseña propia.
 * - K6_CORREO, K6_PASSWORD, K6_CODIGO_QR: cuenta de garita de prueba y bicicleta de prueba (sonda de garita).
 * Ambas cuentas se verifican una sola vez en setup: si fallan, la prueba no empieza (no se acumulan intentos).
 */

const modo = String(__ENV.K6_MODO || 'carga').trim().toLowerCase();
if (!['carga', 'escalonada'].includes(modo)) {
  throw new Error(`K6_MODO no válido: "${modo}". Use "carga" o "escalonada".`);
}
const escalonada = modo === 'escalonada';

const enteros = (texto, defecto) => String(texto || defecto)
  .split(',')
  .map((n) => Number.parseInt(n.trim(), 10))
  .filter((n) => Number.isInteger(n) && n > 0);
const NIVELES = enteros(__ENV.K6_NIVELES, '10,25,50');
const INICIOS_MIN = enteros(__ENV.K6_INICIOS_MIN, '15,30,60,120');
const RAMPA_S = Number.parseInt(__ENV.K6_RAMPA_S || '30', 10);
const MESETA_S = Number.parseInt(__ENV.K6_MESETA_S || '90', 10);
const SONDA_POR_S = 2; // dos garitas, una consulta por segundo cada una
if (escalonada && (!NIVELES.length || !INICIOS_MIN.length || !(RAMPA_S > 0) || !(MESETA_S > 0))) {
  throw new Error('Configuración escalonada no válida: revise K6_NIVELES, K6_INICIOS_MIN, K6_RAMPA_S y K6_MESETA_S.');
}

const CICLO = RAMPA_S + MESETA_S;
const FASE1_S = escalonada ? NIVELES.length * CICLO + 30 : 120;
const FASE2_S = escalonada ? INICIOS_MIN.length * CICLO : 0;
const TOTAL_S = FASE1_S + FASE2_S;

/** Etiqueta del instante (segundos desde el inicio de la prueba): nav-N o login-R en la meseta; rampa fuera de ella. */
function etiquetaNivel(t) {
  if (!escalonada) return 'carga';
  if (t < FASE1_S) {
    const i = Math.floor(t / CICLO);
    return i < NIVELES.length && t - i * CICLO >= RAMPA_S ? `nav-${NIVELES[i]}` : 'rampa';
  }
  const t2 = t - FASE1_S;
  const i = Math.floor(t2 / CICLO);
  return i < INICIOS_MIN.length && t2 - i * CICLO >= RAMPA_S ? `login-${INICIOS_MIN[i]}` : 'rampa';
}
const ahora = (desfase) => etiquetaNivel((Date.now() - exec.scenario.startTime) / 1000 + desfase);

// ---------- Escenarios ----------
const sonda = {
  executor: 'constant-arrival-rate', exec: 'garita', rate: SONDA_POR_S, timeUnit: '1s',
  duration: `${TOTAL_S}s`, preAllocatedVUs: 4, maxVUs: 30,
};
const scenarios = escalonada
  ? {
    navegacion: {
      executor: 'ramping-vus', exec: 'navegacion', startVUs: 0, gracefulRampDown: '10s',
      stages: [
        ...NIVELES.flatMap((n) => [{ duration: `${RAMPA_S}s`, target: n }, { duration: `${MESETA_S}s`, target: n }]),
        { duration: '30s', target: 0 },
      ],
    },
    inicios: {
      executor: 'ramping-arrival-rate', exec: 'inicioSesion', startTime: `${FASE1_S}s`, startRate: 0, timeUnit: '1m',
      preAllocatedVUs: 10, maxVUs: 60,
      stages: INICIOS_MIN.flatMap((r) => [{ duration: `${RAMPA_S}s`, target: r }, { duration: `${MESETA_S}s`, target: r }]),
    },
    garita: sonda,
  }
  : {
    navegacion: { executor: 'constant-vus', exec: 'navegacion', vus: 10, duration: '2m' },
    garita: sonda,
  };

// ---------- Umbrales ----------
const thresholds = {
  // Cortes de seguridad para no dejar sin servicio al piloto.
  'http_req_duration{escenario:garita}': [{ threshold: 'p(95)<10000', abortOnFail: true, delayAbortEval: '60s' }],
  'http_req_failed{escenario:garita}': [{ threshold: 'rate<0.30', abortOnFail: true, delayAbortEval: '60s' }],
};
const submetricas = (selector) => {
  thresholds[`http_req_duration{${selector}}`] = ['max>=0'];
  thresholds[`http_req_failed{${selector}}`] = ['rate>=0'];
  thresholds[`http_reqs{${selector}}`] = ['count>=0'];
};
if (escalonada) {
  thresholds['http_req_failed{escenario:login}'] = [{ threshold: 'rate<0.50', abortOnFail: true, delayAbortEval: '60s' }];
  for (const n of NIVELES) ['perfil', 'historial', 'garita'].forEach((e) => submetricas(`escenario:${e},nivel:nav-${n}`));
  for (const r of INICIOS_MIN) ['login', 'garita'].forEach((e) => submetricas(`escenario:${e},nivel:login-${r}`));
} else {
  ['perfil', 'historial', 'garita'].forEach((e) => submetricas(`escenario:${e}`));
}

export const options = { scenarios, thresholds };

// ---------- Setup ----------
const iniciarSesion = (baseUrl, correo, password, tags, timeout = '30s') => http.post(
  `${baseUrl}/api/v1/auth/login`,
  JSON.stringify({ correo, password }),
  { headers: { 'Content-Type': 'application/json' }, tags, timeout },
);

export function setup() {
  const baseUrl = (__ENV.K6_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/i.test(baseUrl)) {
    throw new Error(`URL base no válida: "${baseUrl}". Deje vacío el campo base_url del workflow o escriba la dirección completa.`);
  }
  const estudiante = { correo: (__ENV.K6_CORREO_ESTUDIANTE || '').trim(), password: __ENV.K6_PASSWORD_ESTUDIANTE };
  const garita = { correo: (__ENV.K6_CORREO || '').trim(), password: __ENV.K6_PASSWORD };
  const codigoQr = __ENV.K6_CODIGO_QR || 'b0000000-0000-4000-8000-0000000000a1';
  if (!estudiante.correo || !estudiante.password) throw new Error('Defina los secretos K6_CORREO_ESTUDIANTE y K6_PASSWORD_ESTUDIANTE.');
  if (!garita.correo || !garita.password) throw new Error('Defina los secretos K6_CORREO y K6_PASSWORD (cuenta de garita de prueba).');

  http.get(`${baseUrl}/health`, { timeout: '60s', tags: { fase: 'calentamiento' } });

  const resEst = iniciarSesion(baseUrl, estudiante.correo, estudiante.password, { fase: 'verificacion' });
  if (resEst.status !== 200) throw new Error(`No se pudo iniciar sesión con la cuenta de estudiante de prueba (${resEst.status}).`);
  if (resEst.json('idRol') !== 1) throw new Error('La cuenta K6_CORREO_ESTUDIANTE no tiene el rol Estudiante.');
  if (resEst.json('debeCambiarPassword')) throw new Error('La cuenta de estudiante de prueba tiene una contraseña temporal: cámbiela antes.');

  const resGar = iniciarSesion(baseUrl, garita.correo, garita.password, { fase: 'verificacion' });
  if (resGar.status !== 200) throw new Error(`No se pudo iniciar sesión con la cuenta de garita de prueba (${resGar.status}).`);

  return { baseUrl, estudiante, codigoQr, tokenGarita: resGar.json('token') };
}

// ---------- Comportamiento de los usuarios virtuales ----------
let tokenSesion = null; // sesión del usuario virtual: se inicia una vez y se reutiliza (como el JWT de 30 min)

export function navegacion(data) {
  const nivel = ahora(0);
  if (!tokenSesion) {
    const r = iniciarSesion(data.baseUrl, data.estudiante.correo, data.estudiante.password,
      { perfil: 'estudiante', escenario: 'login_sesion', nivel }, '10s');
    if (r.status !== 200) { sleep(1); return; }
    tokenSesion = r.json('token');
  }
  const params = (escenario) => ({ headers: { Authorization: `Bearer ${tokenSesion}` }, tags: { perfil: 'estudiante', escenario, nivel }, timeout: '10s' });
  const perfil = http.get(`${data.baseUrl}/api/v1/estudiante/perfil`, params('perfil'));
  const historial = http.get(`${data.baseUrl}/api/v1/estudiante/historial?pagina=1&tamano=10`, params('historial'));
  check(perfil, { 'perfil status es 200': (r) => r.status === 200 });
  check(historial, { 'historial status es 200': (r) => r.status === 200 });
  if (perfil.status === 401 || historial.status === 401) tokenSesion = null;
  sleep(1);
}

export function inicioSesion(data) {
  const r = iniciarSesion(data.baseUrl, data.estudiante.correo, data.estudiante.password,
    { perfil: 'estudiante', escenario: 'login', nivel: ahora(FASE1_S) }, '10s');
  check(r, { 'login status es 200': (x) => x.status === 200 });
}

export function garita(data) {
  const r = http.get(`${data.baseUrl}/api/v1/bicicletas/${encodeURIComponent(data.codigoQr)}`, {
    headers: { Authorization: `Bearer ${data.tokenGarita}` },
    tags: { perfil: 'garita', escenario: 'garita', nivel: ahora(0) },
    timeout: '10s',
  });
  check(r, { 'garita status es 200': (x) => x.status === 200 });
}

// ---------- Resumen ----------
const r2 = (v) => Number((v || 0).toFixed(2));
function medir(data, selector) {
  const d = data.metrics[`http_req_duration{${selector}}`]?.values;
  const f = data.metrics[`http_req_failed{${selector}}`]?.values;
  const solicitudes = data.metrics[`http_reqs{${selector}}`]?.values?.count || 0;
  const p95Ms = r2(d?.['p(95)']);
  const errorPct = r2((f?.rate || 0) * 100);
  return { solicitudes, mediaMs: r2(d?.avg), p95Ms, maximoMs: r2(d?.max), errorPct, cumple: solicitudes > 0 && p95Ms < 2000 && errorPct < 1 };
}
const celda = (m) => (m.solicitudes ? `${m.p95Ms} ms · ${m.errorPct} %` : '—');
const marca = (ok, alcanzado) => (!alcanzado ? 'No alcanzado' : ok ? '✓ Cumple' : '✗ No cumple');
function capacidad(lista) {
  let max = 0;
  for (const x of lista) { if (!x.cumple) break; max = x.valor; }
  return max;
}

export function handleSummary(data) {
  const fecha = new Date().toISOString();
  const pie = '> Nota: p95 · error. Solo se miden las mesetas. Las solicitudes que superan 10 s se cuentan como error. La sonda de garita simula 2 garitas con una consulta por QR por segundo cada una.';

  if (!escalonada) {
    const ops = { perfil: medir(data, 'escenario:perfil'), historial: medir(data, 'escenario:historial'), garita: medir(data, 'escenario:garita') };
    const cumple = Object.values(ops).every((m) => m.cumple);
    const md = `# Prueba de Carga — Portal del Estudiante (k6)

- **Fecha de ejecución**: ${fecha}
- **Escenario**: 10 sesiones de estudiante navegando (perfil → historial, pausa de 1 s) durante 2 min, con la sonda de garita; solo lectura
- **Referencia**: p95 < 2000 ms y error < 1 %
- **Resultado**: **${cumple ? 'CUMPLE' : 'NO CUMPLE'}**

| Operación | Solicitudes | Media | p95 | Máximo | Error |
|---|---|---|---|---|---|
${Object.entries(ops).map(([k, m]) => `| ${k} | ${m.solicitudes} | ${m.mediaMs} ms | ${m.p95Ms} ms | ${m.maximoMs} ms | ${m.errorPct} % |`).join('\n')}

${pie}
`;
    return {
      'tests/carga/resultados/resumen-estudiante.json': JSON.stringify({ fecha, modo, operaciones: ops, cumple }, null, 2),
      'tests/carga/resultados/resumen-estudiante.md': md,
      stdout: `\n=== CARGA PORTAL DEL ESTUDIANTE ===\n${Object.entries(ops).map(([k, m]) => `${k}: ${celda(m)}`).join('\n')}\nResultado: ${cumple ? 'CUMPLE' : 'NO CUMPLE'}\n===================================\n`,
    };
  }

  const nav = NIVELES.map((n) => {
    const perfil = medir(data, `escenario:perfil,nivel:nav-${n}`);
    const historial = medir(data, `escenario:historial,nivel:nav-${n}`);
    const gar = medir(data, `escenario:garita,nivel:nav-${n}`);
    return { valor: n, alcanzado: perfil.solicitudes > 0, perfil, historial, garita: gar, cumple: perfil.cumple && historial.cumple && gar.cumple };
  });
  const ini = INICIOS_MIN.map((r) => {
    const login = medir(data, `escenario:login,nivel:login-${r}`);
    const gar = medir(data, `escenario:garita,nivel:login-${r}`);
    const completadosMin = r2(((login.solicitudes * (1 - login.errorPct / 100)) / MESETA_S) * 60);
    return { valor: r, alcanzado: login.solicitudes > 0, login, garita: gar, completadosMin, cumple: login.cumple, garitaCumple: gar.cumple };
  });

  const capNav = capacidad(nav);
  const capLogin = capacidad(ini);
  const capGarita = capacidad(ini.map((x) => ({ valor: x.valor, cumple: x.alcanzado && x.garitaCumple })));
  const noAlcanzada = 'no alcanzada (la prueba se detuvo antes)';
  const conclusiones = [
    `Navegación: ${!nav[0].alcanzado ? noAlcanzada : capNav ? `hasta ${capNav} estudiantes con sesión abierta cumplen la referencia de 2 s (perfil, historial y garita)` : 'ningún nivel cumple la referencia de 2 s'}.`,
    `Inicios de sesión: ${!ini[0].alcanzado ? noAlcanzada : capLogin ? `hasta ${capLogin} por minuto con p95 < 2 s y error < 1 %` : `incluso ${INICIOS_MIN[0]} por minuto superan la referencia de 2 s`}.`,
    `Garita (RNF-01) durante los inicios de sesión: ${!ini[0].alcanzado ? noAlcanzada : capGarita ? `cumple hasta ${capGarita} inicios de sesión por minuto` : `se incumple ya con ${INICIOS_MIN[0]} inicios de sesión por minuto`}.`,
  ];

  const md = `# Prueba de Carga Escalonada — Portal del Estudiante y efecto en la Garita (k6)

- **Fecha de ejecución**: ${fecha}
- **Fase 1 · Navegación**: ${NIVELES.join(', ')} estudiantes con sesión abierta (inician sesión una vez; luego perfil → historial → pausa de 1 s)
- **Fase 2 · Inicios de sesión**: ${INICIOS_MIN.join(', ')} inicios de sesión por minuto (BCrypt costo 12)
- **Sonda de garita**: 2 garitas, 1 consulta por QR por segundo cada una, durante toda la prueba
- **Rampa / meseta medida**: ${RAMPA_S} s / ${MESETA_S} s por nivel; solo lectura
- **Referencia**: p95 < 2000 ms y error < 1 %

## Conclusiones

${conclusiones.map((c) => `- ${c}`).join('\n')}

## Fase 1 · Navegación

| Estudiantes | Perfil | Historial | Garita (RNF-01) | Resultado |
|---|---|---|---|---|
${nav.map((x) => `| ${x.valor} | ${celda(x.perfil)} | ${celda(x.historial)} | ${celda(x.garita)} | ${marca(x.cumple, x.alcanzado)} |`).join('\n')}

## Fase 2 · Inicios de sesión

| Inicios/min solicitados | Completados/min | Inicio de sesión | Media inicio de sesión | Garita (RNF-01) | Inicio de sesión < 2 s | Garita < 2 s |
|---|---|---|---|---|---|---|
${ini.map((x) => `| ${x.valor} | ${x.alcanzado ? x.completadosMin : '—'} | ${celda(x.login)} | ${x.alcanzado ? `${x.login.mediaMs} ms` : '—'} | ${celda(x.garita)} | ${marca(x.cumple, x.alcanzado)} | ${marca(x.garitaCumple, x.alcanzado)} |`).join('\n')}

${pie}
`;
  return {
    'tests/carga/resultados/resumen-escalonada-estudiante.json': JSON.stringify({
      fecha, modo, configuracion: { niveles: NIVELES, iniciosPorMinuto: INICIOS_MIN, rampaSegundos: RAMPA_S, mesetaSegundos: MESETA_S, sondaGaritaPorSegundo: SONDA_POR_S },
      navegacion: nav, iniciosDeSesion: ini, capacidad: { navegacion: capNav, iniciosPorMinuto: capLogin, garitaHastaIniciosPorMinuto: capGarita }, conclusiones,
    }, null, 2),
    'tests/carga/resultados/resumen-escalonada-estudiante.md': md,
    stdout: `\n=== PORTAL DEL ESTUDIANTE Y GARITA ===\n${nav.map((x) => `nav ${x.valor}: perfil ${celda(x.perfil)} | historial ${celda(x.historial)} | garita ${celda(x.garita)}`).join('\n')}\n${ini.map((x) => `login ${x.valor}/min: login ${celda(x.login)} (completados ${x.completadosMin}/min) | garita ${celda(x.garita)}`).join('\n')}\n${conclusiones.join('\n')}\n======================================\n`,
  };
}
