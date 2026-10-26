/**
 * Servicio de pre-calentamiento y latido de la API REST para producción (Render free tier).
 * Envía pings no bloqueantes para despertar el contenedor en segundo plano y mantenerlo
 * activo mediante un latido periódico cada 9 minutos.
 *
 * Para no agotar las 750 horas gratuitas mensuales, el latido solo se envía con la pestaña
 * visible y dentro del horario de operación de la garita (06:00–22:00, hora de Lima). Fuera
 * de ese horario el contenedor puede dormir; al abrir la página se despierta de inmediato.
 */

export const HORARIO_OPERACION = Object.freeze({ inicio: 6, fin: 22 });

const HORA_LIMA = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'America/Lima' });

/** true si la hora de Lima está dentro del horario de operación de la garita. */
export function dentroDeHorario(fecha = new Date()) {
  const hora = Number(HORA_LIMA.format(fecha));
  return hora >= HORARIO_OPERACION.inicio && hora < HORARIO_OPERACION.fin;
}

const pestanaVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

let intervaloActivo = null;

export function despertarApi(urlApi = import.meta.env.VITE_API_URL) {
  if (!urlApi) return;
  const urlBase = urlApi.replace(/\/api\/v1\/?$/, '');
  const urlSalud = `${urlBase}/health`;

  void fetch(urlSalud, { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}

export function iniciarPrecalentamiento(urlApi = import.meta.env.VITE_API_URL) {
  if (intervaloActivo) return;

  despertarApi(urlApi);

  if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
    intervaloActivo = window.setInterval(() => {
      if (pestanaVisible() && dentroDeHorario()) despertarApi(urlApi);
    }, 9 * 60 * 1000);
  }
}

export function detenerPrecalentamiento() {
  if (intervaloActivo && typeof window !== 'undefined') {
    window.clearInterval(intervaloActivo);
    intervaloActivo = null;
  }
}
