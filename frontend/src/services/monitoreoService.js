import { api } from './apiClient';
import { limpiar } from './estudianteService';

export const obtenerResumen = async () => (await api.get('/monitoreo/resumen')).data;

export const consultarEventos = async (filtros) => (await api.get('/monitoreo/eventos', { params: limpiar(filtros) })).data;

/** Descarga el CSV generado por la API con los mismos filtros de la tabla. */
export async function exportarCsv(filtros) {
  const { data, headers } = await api.get('/monitoreo/eventos/exportar', { params: limpiar(filtros), responseType: 'blob', timeout: 60000 });
  const nombre = /filename="?([^";]+)"?/.exec(headers?.['content-disposition'] ?? '')?.[1] ?? 'monitoreo.csv';
  const url = URL.createObjectURL(data);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
