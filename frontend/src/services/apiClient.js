import axios from 'axios';

// Cliente único de la API REST. El frontend nunca accede directamente a Supabase.
// 4 s sin respuesta → modo degradado y protocolo de contingencia (P05 1.8.1).
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL, timeout: 4000 });

const esLogin = (config) => config?.url?.includes('/auth/login');

export function configurarInterceptores({ obtenerToken, cerrarSesion, avisar }) {
  api.interceptors.request.use((config) => {
    const token = obtenerToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(
    (respuesta) => respuesta,
    (error) => {
      if (!error.response) {
        avisar('Sin conexión con el servidor. Aplique el protocolo de contingencia.');
      } else if (error.response.status === 401 && !esLogin(error.config)) {
        cerrarSesion(); // token vencido o inválido: por eso un retiro DENEGADO no usa 401
      } else if (error.response.status === 403 && !esLogin(error.config)) {
        avisar('No tiene permiso para realizar esta operación.');
      }
      return Promise.reject(error);
    },
  );
}

/** Mensaje legible de un error de la API (ProblemDetails) para mostrarlo en pantalla. */
export function mensajeDeError(error, porDefecto = 'Ocurrió un error inesperado.') {
  if (!error?.response) return 'Sin conexión con el servidor. Intente nuevamente.';
  return error.response.data?.detail ?? porDefecto;
}
