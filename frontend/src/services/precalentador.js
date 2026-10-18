/**
 * Servicio de pre-calentamiento y latido de la API REST para producción (Render free tier).
 * Envía pings no bloqueantes para despertar el contenedor en segundo plano y mantenerlo
 * activo mediante un latido periódico cada 9 minutos.
 */

let intervaloActivo = null;

export function despertarApi(urlApi = import.meta.env.VITE_API_URL) {
  if (!urlApi) return;
  const urlBase = urlApi.replace(/\/api\/v1\/?$/, '');
  const urlSalud = `${urlBase}/health`;

  void fetch(urlSalud, { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  void fetch(`${urlApi}/garita/ultimo-dia`, { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}

export function iniciarPrecalentamiento(urlApi = import.meta.env.VITE_API_URL) {
  if (intervaloActivo) return;

  despertarApi(urlApi);

  if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
    intervaloActivo = window.setInterval(() => {
      despertarApi(urlApi);
    }, 9 * 60 * 1000);
  }
}

export function detenerPrecalentamiento() {
  if (intervaloActivo && typeof window !== 'undefined') {
    window.clearInterval(intervaloActivo);
    intervaloActivo = null;
  }
}
