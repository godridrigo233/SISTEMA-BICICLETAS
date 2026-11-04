import { describe, expect, it } from 'vitest';
import { CODIGOS_CALIDAD, UMBRALES_CALIDAD, UMBRALES_ENROLAMIENTO, evaluarCalidad, medirBrillo, mensajeCalidad } from './calidadCaptura';

/** 68 puntos de un rostro frontal sintético, con desplazamientos para simular giro, inclinación y cabeceo. */
function puntosSinteticos({ narizX = 200, narizY = 215, ojoDerechoY = 170 } = {}) {
  const puntos = Array.from({ length: 68 }, () => ({ x: 200, y: 230 }));
  puntos[0] = { x: 120, y: 200 };
  puntos[16] = { x: 280, y: 200 };
  puntos[8] = { x: 200, y: 300 };
  for (let i = 36; i < 42; i += 1) puntos[i] = { x: 165, y: 170 };
  for (let i = 42; i < 48; i += 1) puntos[i] = { x: 235, y: ojoDerechoY };
  puntos[30] = { x: narizX, y: narizY };
  return puntos;
}

const caja = { x: 230, y: 130, width: 180, height: 220 };
const base = { caja, puntos: puntosSinteticos(), anchoVideo: 640, altoVideo: 480, brillo: 130 };

describe('Control de calidad de la captura facial', () => {
  it('acepta un rostro frontal, centrado, a buena distancia y bien iluminado', () => {
    const r = evaluarCalidad(base);
    expect(r.apta).toBe(true);
    expect(r.problema).toBeNull();
    expect(r.metricas.simetria).toBeCloseTo(1, 1);
  });

  it('rechaza el rostro girado hacia un lado (causa de los rechazos genuinos del 02/11)', () => {
    const r = evaluarCalidad({ ...base, puntos: puntosSinteticos({ narizX: 250 }) });
    expect(r.apta).toBe(false);
    expect(r.problema).toBe('NO_DE_FRENTE');
  });

  it('rechaza la cabeza agachada o levantada (cabeceo)', () => {
    expect(evaluarCalidad({ ...base, puntos: puntosSinteticos({ narizY: 260 }) }).problema).toBe('NO_DE_FRENTE');
    expect(evaluarCalidad({ ...base, puntos: puntosSinteticos({ narizY: 180 }) }).problema).toBe('NO_DE_FRENTE');
  });

  it('rechaza la cabeza inclinada', () => {
    expect(evaluarCalidad({ ...base, puntos: puntosSinteticos({ ojoDerechoY: 200 }) }).problemas).toContain('INCLINADO');
  });

  it('detecta el rostro lejano, demasiado cercano o fuera del óvalo', () => {
    expect(evaluarCalidad({ ...base, caja: { x: 290, y: 200, width: 80, height: 100 } }).problema).toBe('MUY_LEJOS');
    expect(evaluarCalidad({ ...base, caja: { x: 50, y: 0, width: 540, height: 480 } }).problema).toBe('MUY_CERCA');
    expect(evaluarCalidad({ ...base, caja: { x: 0, y: 130, width: 180, height: 220 } }).problema).toBe('FUERA_DE_CENTRO');
    expect(evaluarCalidad({ ...base, caja: { x: 500, y: 130, width: 180, height: 220 } }).problema).toBe('FUERA_DE_CENTRO');
  });

  it('detecta la falta o el exceso de luz y omite la medición si no está disponible', () => {
    expect(evaluarCalidad({ ...base, brillo: 30 }).problema).toBe('POCA_LUZ');
    expect(evaluarCalidad({ ...base, brillo: 240 }).problema).toBe('MUCHA_LUZ');
    expect(evaluarCalidad({ ...base, brillo: null }).apta).toBe(true);
  });

  it('el enrolamiento exige una pose más frontal que el retiro', () => {
    const levementeGirado = { ...base, puntos: puntosSinteticos({ narizX: 218 }) };
    const r = evaluarCalidad(levementeGirado, UMBRALES_CALIDAD);
    expect(r.metricas.simetria).toBeGreaterThan(UMBRALES_CALIDAD.simetriaMinima);
    expect(r.metricas.simetria).toBeLessThan(UMBRALES_ENROLAMIENTO.simetriaMinima);
    expect(r.apta).toBe(true);
    expect(evaluarCalidad(levementeGirado, UMBRALES_ENROLAMIENTO).problema).toBe('NO_DE_FRENTE');
  });

  it('dirige los mensajes al vigilante en el retiro y al titular en el enrolamiento', () => {
    expect(mensajeCalidad('NO_DE_FRENTE', 'vigilante')).toBe('Pida al estudiante que mire de frente a la cámara.');
    expect(mensajeCalidad('NO_DE_FRENTE', 'titular')).toBe('Mire de frente a la cámara.');
    for (const codigo of CODIGOS_CALIDAD) {
      expect(mensajeCalidad(codigo, 'vigilante')).toBeTruthy();
      expect(mensajeCalidad(codigo, 'titular')).toBeTruthy();
    }
  });

  it('mide el brillo en un lienzo de 32 × 32 y lo limpia, sin conservar la imagen', () => {
    let limpiado = false;
    const contexto = {
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4).fill(100) }),
      clearRect: () => { limpiado = true; },
    };
    const lienzo = { getContext: () => contexto };
    expect(medirBrillo({}, caja, lienzo)).toBeCloseTo(100, 5);
    expect(lienzo.width).toBe(32);
    expect(limpiado).toBe(true);
    expect(medirBrillo({}, caja, { getContext: () => null })).toBeNull();
    expect(medirBrillo({}, caja, { getContext: () => { throw new Error('x'); } })).toBeNull();
  });
});
