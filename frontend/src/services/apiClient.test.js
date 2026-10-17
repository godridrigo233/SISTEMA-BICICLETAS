import { describe, expect, it, vi } from 'vitest';
import { api, configurarInterceptores } from './apiClient';

function responderCon(status) {
  api.defaults.adapter = (config) =>
    status === 200
      ? Promise.resolve({ data: { ok: true }, status, statusText: 'OK', headers: {}, config })
      : Promise.reject(Object.assign(new Error(`HTTP ${status}`), { config, response: { status, data: {} } }));
}

describe('apiClient', () => {
  const cerrarSesion = vi.fn();
  const avisar = vi.fn();
  configurarInterceptores({ obtenerToken: () => 'jwt-de-prueba', cerrarSesion, avisar });

  it('adjunta el token JWT en la cabecera Authorization', async () => {
    responderCon(200);
    const respuesta = await api.get('/health');
    expect(respuesta.config.headers.Authorization).toBe('Bearer jwt-de-prueba');
  });

  it('cierra la sesión ante un 401', async () => {
    responderCon(401);
    await expect(api.get('/bicicletas/x')).rejects.toThrow();
    expect(cerrarSesion).toHaveBeenCalledOnce();
  });

  it('avisa sin cerrar la sesión ante un 403', async () => {
    cerrarSesion.mockClear();
    responderCon(403);
    await expect(api.get('/admin/usuarios')).rejects.toThrow();
    expect(avisar).toHaveBeenCalledWith('No tiene permiso para realizar esta operación.');
    expect(cerrarSesion).not.toHaveBeenCalled();
  });
});
