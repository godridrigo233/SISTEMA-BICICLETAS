import { describe, expect, it } from 'vitest';
import { DIMENSIONES_DESCRIPTOR, ErrorBiometrico, seleccionarRostroUnico } from './extractorFacial';

const rostro = (n = DIMENSIONES_DESCRIPTOR) => ({ descriptor: new Float32Array(n).fill(0.1) });

describe('Extracción del descriptor (rostro único, CU-04 3a)', () => {
  it('devuelve un arreglo de 128 números a partir de un único rostro', () => {
    const descriptor = seleccionarRostroUnico([rostro()]);
    expect(descriptor).toHaveLength(128);
    expect(Array.isArray(descriptor)).toBe(true);
  });

  it('rechaza el encuadre sin rostro', () => {
    expect(() => seleccionarRostroUnico([])).toThrow(ErrorBiometrico);
    expect(() => seleccionarRostroUnico([])).toThrow(/No se detectó el rostro/);
  });

  it('rechaza el encuadre con más de un rostro', () => {
    expect(() => seleccionarRostroUnico([rostro(), rostro()])).toThrow(/más de un rostro/);
  });

  it('rechaza un descriptor con dimensión distinta de 128', () => {
    expect(() => seleccionarRostroUnico([rostro(64)])).toThrow(/no es válido/);
  });
});
