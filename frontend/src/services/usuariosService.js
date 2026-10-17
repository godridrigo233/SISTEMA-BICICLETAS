import { api } from './apiClient';
import { limpiar } from './estudianteService';

export const listarUsuarios = async (filtros) => (await api.get('/usuarios', { params: limpiar(filtros) })).data;
export const crearUsuario = async (correo, idRol) => (await api.post('/usuarios', { correo, idRol })).data;
export const restablecerPassword = async (id) => (await api.post(`/usuarios/${id}/restablecer-password`)).data;
export const cambiarEstado = async (id, activo) => (await api.patch(`/usuarios/${id}/estado`, { activo })).data;
