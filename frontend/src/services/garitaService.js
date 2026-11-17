import { api } from './apiClient';

export async function consultarPorQr(codigoQr) {
  const { data } = await api.get(`/bicicletas/${encodeURIComponent(codigoQr.trim())}`);
  return data;
}

/** D-25: ingresos y retiros que el operador registró hoy, para reconstruir «Últimos movimientos». */
export async function consultarMovimientosRecientes() {
  const { data } = await api.get('/garita/movimientos-recientes');
  return data; // [{ idAuditoria, fechaUtc, tipoEvento, resultado, titular, bicicleta }]
}

export async function registrarIngreso(idBicicleta, latenciaMs) {
  const { data } = await api.post('/ingresos/registrar', { idBicicleta, latenciaMs });
  return data;
}

/** Envía solo el descriptor transitorio de 128 valores; la API decide y lo descarta. */
export async function autorizarRetiro(idBicicleta, descriptorCapturado, latenciaMs) {
  const { data } = await api.post('/retiros/autorizar', { idBicicleta, descriptorCapturado, latenciaMs });
  return data; // { resultado, estadoActualizado, distanciaEuclidiana, umbralTheta }
}

/** Derivación al Supervisor: retiro manual verificando el DNI físico del titular (solo Supervisor/Admin). */
export async function retiroManual(idBicicleta, dniVerificado) {
  const { data } = await api.post('/retiros/manual', { idBicicleta, dniVerificado });
  return data; // { resultado: 'AUTORIZADO_MANUAL', estadoActualizado: 'FUERA' }
}
