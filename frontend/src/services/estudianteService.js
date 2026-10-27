import { api } from './apiClient';
import { VERSION_MODELO } from '../biometria/extractorFacial';

export const obtenerPerfil = async () => (await api.get('/estudiante/perfil')).data;

export const registrarBicicleta = async (datos) => (await api.post('/estudiante/bicicletas', datos)).data;

export async function enrolar(descriptor) {
  await api.put('/estudiante/enrolamiento', { descriptor, consentimientoAceptado: true, versionModelo: VERSION_MODELO });
}

/** W5: el servidor filtra por el estudiante del token; aquí solo se envían filtros y página. */
export const consultarHistorial = async (filtros) => (await api.get('/estudiante/historial', { params: limpiar(filtros) })).data;

export const limpiar = (filtros) => Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '' && v != null));
