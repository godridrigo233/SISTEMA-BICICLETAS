import { afterEach, describe, expect, it, vi } from 'vitest';
import { comprobarConexion, estaConectado, marcarConexion, suscribirConexion } from './conexion';
import { api, configurarInterceptores } from './apiClient';

describe('estado de la conexión (Nielsen H1)', () => {
  afterEach(() => { marcarConexion(true); vi.unstubAllGlobals(); });

  it('notifica a los suscriptores solo cuando el estado cambia', () => {
    const oyente = vi.fn();
    const desuscribir = suscribirConexion(oyente);
    marcarConexion(true);
    expect(oyente).not.toHaveBeenCalled();
    marcarConexion(false);
    expect(oyente).toHaveBeenCalledWith(false);
    expect(estaConectado()).toBe(false);
    desuscribir();
  });

  it('el interceptor marca «sin conexión» ante un error de red y «en línea» ante una respuesta', async () => {
    configurarInterceptores({ obtenerToken: () => null, cerrarSesion: vi.fn(), avisar: vi.fn() });
    api.defaults.adapter = (config) => Promise.reject(Object.assign(new Error('Network Error'), { config }));
    await expect(api.get('/x')).rejects.toThrow();
    expect(estaConectado()).toBe(false);
    api.defaults.adapter = (config) => Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
    await api.get('/x');
    expect(estaConectado()).toBe(true);
  });

  it('comprobarConexion consulta /health de la API y restablece el estado', async () => {
    const fetch = vi.fn().mockResolvedValue({});
    vi.stubGlobal('fetch', fetch);
    marcarConexion(false);
    await comprobarConexion('https://api.ejemplo.pe/api/v1');
    expect(fetch).toHaveBeenCalledWith('https://api.ejemplo.pe/health', expect.objectContaining({ mode: 'no-cors' }));
    expect(estaConectado()).toBe(true);
  });

  it('si /health no responde, sigue sin conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await comprobarConexion('https://api.ejemplo.pe/api/v1');
    expect(estaConectado()).toBe(false);
  });
});
