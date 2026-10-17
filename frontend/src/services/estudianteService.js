import { api } from './apiClient';

export const obtenerPerfil = async () => (await api.get('/estudiante/perfil')).data;

export const registrarBicicleta = async (datos) => (await api.post('/estudiante/bicicletas', datos)).data;

export async function enrolar(descriptor) {
  await api.put('/estudiante/enrolamiento', { descriptor, consentimientoAceptado: true, versionModelo: 'face-api-0.22.2' });
}
