import { api } from './apiClient';

const LARGO = { timeout: 30000 };

export const previsualizarCsv = async (contenido) => (await api.post('/contingencias/csv/previsualizar', { contenido }, LARGO)).data;
export const importarCsv = async (contenido) => (await api.post('/contingencias/csv/importar', { contenido }, LARGO)).data;
export const previsualizarFila = async (fila) => (await api.post('/contingencias/fila/previsualizar', fila)).data;
export const registrarFila = async (fila) => (await api.post('/contingencias/fila', fila)).data;
export const listarPendientes = async () => (await api.get('/contingencias/pendientes')).data;
export const listarVigilantes = async () => (await api.get('/contingencias/vigilantes')).data;
export const obtenerDetalle = async (id) => (await api.get(`/contingencias/${id}`)).data;
export const conciliar = async (id) => (await api.post(`/contingencias/${id}/conciliar`)).data;
export const conciliarLote = async () => (await api.post('/contingencias/conciliar-lote', null, LARGO)).data;
export const revisar = async (id, revision) => (await api.post(`/contingencias/${id}/revisar`, revision)).data;
