import { api } from './apiClient';

// El login tolera hasta 60 s: la instancia gratuita de Render puede tardar en despertar.
// La Garita mantiene los 4 s del cliente para pasar rápido al protocolo de contingencia.
const ESPERA_LOGIN_MS = 60000;

export async function iniciarSesion(correo, password) {
  const { data } = await api.post('/auth/login', { correo, password }, { timeout: ESPERA_LOGIN_MS });
  return data; // { token, expiraEnUtc, idRol, debeCambiarPassword }
}

export async function cambiarPassword(token, passwordActual, passwordNueva) {
  const { data } = await api.post(
    '/auth/cambiar-password',
    { passwordActual, passwordNueva },
    { headers: { Authorization: `Bearer ${token}` }, timeout: ESPERA_LOGIN_MS },
  );
  return data;
}
