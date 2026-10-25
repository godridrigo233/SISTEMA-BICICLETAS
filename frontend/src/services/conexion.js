import { useEffect, useState } from 'react';

/**
 * Estado de la conexión con la API (Nielsen H1: visibilidad del estado del sistema).
 * Se actualiza con cada respuesta de la API (interceptor de apiClient) y con los eventos
 * online/offline del navegador. Mientras no hay conexión se comprueba /health cada 15 s.
 */
let conectado = typeof navigator === 'undefined' || navigator.onLine !== false;
const oyentes = new Set();

export const estaConectado = () => conectado;

export function marcarConexion(valor) {
  if (valor === conectado) return;
  conectado = valor;
  oyentes.forEach((oyente) => oyente(valor));
}

export function suscribirConexion(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => marcarConexion(true));
  window.addEventListener('offline', () => marcarConexion(false));
}

/** Intenta alcanzar /health; si responde, la conexión se restableció. */
export async function comprobarConexion(urlApi = import.meta.env.VITE_API_URL) {
  if (!urlApi) return;
  const urlSalud = `${urlApi.replace(/\/api\/v1\/?$/, '')}/health`;
  try {
    await fetch(urlSalud, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
    marcarConexion(true);
  } catch {
    marcarConexion(false);
  }
}

export function useConexion(intervaloMs = 15000) {
  const [valor, setValor] = useState(estaConectado);
  useEffect(() => suscribirConexion(setValor), []);
  useEffect(() => {
    if (valor) return undefined;
    const id = setInterval(() => { void comprobarConexion(); }, intervaloMs);
    return () => clearInterval(id);
  }, [valor, intervaloMs]);
  return valor;
}
