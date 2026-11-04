import { afterEach, describe, expect, it, vi } from 'vitest';
import { BRILLO_OBJETIVO, crearAjusteExposicion, mantenerPantallaEncendida } from './camara';

function pistaCon(capacidades, ajustes = {}) {
  const aplicadas = [];
  return {
    aplicadas,
    getCapabilities: () => capacidades,
    getSettings: () => ajustes,
    applyConstraints: vi.fn(async (r) => { aplicadas.push(r.advanced[0]); }),
  };
}

describe('Ajuste automático de la exposición de la cámara', () => {
  it('sube la compensación de exposición cuando el rostro está oscuro, sin pasar el máximo', async () => {
    let t = 0;
    const pista = pistaCon({ exposureCompensation: { min: -2, max: 2, step: 0.5 }, exposureMode: ['manual', 'continuous'] }, { exposureCompensation: 0 });
    const ajustar = crearAjusteExposicion(pista, { ahora: () => t });
    expect(ajustar.disponible).toBe(true);
    expect(ajustar.control).toBe('exposureCompensation');
    expect(pista.aplicadas[0]).toEqual({ exposureMode: 'continuous' });

    expect(ajustar(60)).toBe(true);
    await Promise.resolve(); await Promise.resolve();
    expect(pista.aplicadas.at(-1)).toEqual({ exposureCompensation: 0.5 });
    expect(ajustar(60)).toBe(false); // espera entre ajustes
    for (let i = 0; i < 10; i += 1) { t += 1000; ajustar(60); await Promise.resolve(); await Promise.resolve(); }
    expect(pista.aplicadas.at(-1).exposureCompensation).toBe(2);
  });

  it('no cambia nada cuando el brillo ya es adecuado y baja si hay exceso de luz', async () => {
    let t = 0;
    const pista = pistaCon({ brightness: { min: 0, max: 255, step: 1 } }, { brightness: 128 });
    const ajustar = crearAjusteExposicion(pista, { ahora: () => t });
    expect(ajustar.control).toBe('brightness');
    expect(ajustar(BRILLO_OBJETIVO)).toBe(false);
    t += 1000;
    expect(ajustar(220)).toBe(true);
    await Promise.resolve(); await Promise.resolve();
    expect(pista.aplicadas.at(-1).brightness).toBeLessThan(128);
  });

  it('sin controles de la cámara (p. ej., Safari) no hace nada', () => {
    expect(crearAjusteExposicion(undefined).disponible).toBe(false);
    const ajustar = crearAjusteExposicion(pistaCon({}));
    expect(ajustar.disponible).toBe(false);
    expect(ajustar(40)).toBe(false);
  });
});

describe('Pantalla encendida durante la captura', () => {
  afterEach(() => { delete navigator.wakeLock; });

  it('solicita y libera el bloqueo de pantalla cuando el navegador lo permite', async () => {
    const release = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: vi.fn().mockResolvedValue({ release }) } });
    const liberar = await mantenerPantallaEncendida();
    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    liberar();
    expect(release).toHaveBeenCalled();
  });

  it('si no está disponible o se rechaza, la captura continúa', async () => {
    expect(typeof (await mantenerPantallaEncendida())).toBe('function');
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: vi.fn().mockRejectedValue(new Error('no')) } });
    expect(typeof (await mantenerPantallaEncendida())).toBe('function');
  });
});
