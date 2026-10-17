import { api } from './apiClient';

export async function iniciarSesion(correo, password) {
  const { data } = await api.post('/auth/login', { correo, password });
  return data; // { token, expiraEnUtc, idRol, debeCambiarPassword }
}

export async function cambiarPassword(token, passwordActual, passwordNueva) {
  const { data } = await api.post(
    '/auth/cambiar-password',
    { passwordActual, passwordNueva },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}
