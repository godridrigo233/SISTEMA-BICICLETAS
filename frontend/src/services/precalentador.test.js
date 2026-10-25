import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { despertarApi, detenerPrecalentamiento, iniciarPrecalentamiento } from './precalentador';

describe('Servicio de precalentador de API', () => {
  const fetchOriginal = globalThis.fetch;

  beforeEach(() => {
    detenerPrecalentamiento();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.useFakeTimers();
  });

  afterEach(() => {
    detenerPrecalentamiento();
    globalThis.fetch = fetchOriginal;
    vi.useRealTimers();
  });

  it('no ejecuta fetch si no se proporciona URL de API', () => {
    despertarApi('');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('realiza una única llamada no bloqueante a /health con mode no-cors (sin rutas inexistentes)', () => {
    despertarApi('https://api-bicicletas.onrender.com/api/v1');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api-bicicletas.onrender.com/health',
      expect.objectContaining({ method: 'GET', mode: 'no-cors' }),
    );
  });

  it('tolera rechazos en fetch sin lanzar excepciones', () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    expect(() => despertarApi('https://api-bicicletas.onrender.com/api/v1')).not.toThrow();
  });

  it('inicia el latido periódico y se puede detener correctamente', () => {
    iniciarPrecalentamiento('https://api-bicicletas.onrender.com/api/v1');
    // Segunda llamada no duplica el temporizador
    iniciarPrecalentamiento('https://api-bicicletas.onrender.com/api/v1');

    // Avanzar el tiempo 9 minutos
    vi.advanceTimersByTime(9 * 60 * 1000);
    expect(globalThis.fetch).toHaveBeenCalled();

    detenerPrecalentamiento();
    const llamadasAntes = globalThis.fetch.mock.calls.length;
    vi.advanceTimersByTime(9 * 60 * 1000);
    expect(globalThis.fetch.mock.calls.length).toBe(llamadasAntes);
  });
});
