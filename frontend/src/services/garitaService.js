import { api } from './apiClient';

export async function consultarPorQr(codigoQr) {
  const { data } = await api.get(`/bicicletas/${encodeURIComponent(codigoQr.trim())}`);
  return data;
}

export async function registrarIngreso(idBicicleta, latenciaMs) {
  const { data } = await api.post('/ingresos/registrar', { idBicicleta, latenciaMs });
  return data;
}
