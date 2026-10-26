import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dentroDeHorario, despertarApi, detenerPrecalentamiento, iniciarPrecalentamiento } from './precalentador';

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
    vi.setSystemTime(new Date('2026-11-02T15:00:00Z')); // 10:00 en Lima
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

  it('reconoce el horario de operación de la garita en hora de Lima (06:00–22:00)', () => {
    expect(dentroDeHorario(new Date('2026-11-02T11:00:00Z'))).toBe(true); // 06:00 Lima
    expect(dentroDeHorario(new Date('2026-11-03T02:59:00Z'))).toBe(true); // 21:59 Lima
    expect(dentroDeHorario(new Date('2026-11-03T03:00:00Z'))).toBe(false); // 22:00 Lima
    expect(dentroDeHorario(new Date('2026-11-02T10:59:00Z'))).toBe(false); // 05:59 Lima
  });

  it('fuera del horario no envía latidos, para ahorrar horas del plan gratuito', () => {
    vi.setSystemTime(new Date('2026-11-03T05:00:00Z')); // 00:00 en Lima
    iniciarPrecalentamiento('https://api-bicicletas.onrender.com/api/v1');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // al abrir la página sí se despierta
    vi.advanceTimersByTime(3 * 9 * 60 * 1000);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('con la pestaña oculta no envía latidos', () => {
    vi.setSystemTime(new Date('2026-11-02T15:00:00Z')); // 10:00 en Lima
    const visibilidad = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    iniciarPrecalentamiento('https://api-bicicletas.onrender.com/api/v1');
    vi.advanceTimersByTime(2 * 9 * 60 * 1000);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    visibilidad.mockRestore();
  });
});
