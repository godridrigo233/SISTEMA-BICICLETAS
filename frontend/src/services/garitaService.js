import { api } from './apiClient';

export async function consultarPorQr(codigoQr) {
  const { data } = await api.get(`/bicicletas/${encodeURIComponent(codigoQr.trim())}`);
  return data;
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
