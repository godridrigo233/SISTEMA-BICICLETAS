import { describe, expect, it } from 'vitest';
import { CONFIANZA_MINIMA_DETECCION, DIMENSIONES_DESCRIPTOR, ErrorBiometrico, extraerDescriptor, seleccionarRostroUnico } from './extractorFacial';

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

describe('Detector facial alineado con la calibración de θ = 0.37', () => {
  it('usa SSD MobileNetV1 con confianza mínima de 0.90', async () => {
    const opciones = [];
    const cadena = { withFaceLandmarks: () => cadena, withFaceDescriptors: async () => [{ descriptor: new Float32Array(128) }] };
    const faceapi = {
      nets: {
        ssdMobilenetv1: { loadFromUri: async () => {} },
        faceLandmark68Net: { loadFromUri: async () => {} },
        faceRecognitionNet: { loadFromUri: async () => {} },
      },
      SsdMobilenetv1Options: class { constructor(o) { opciones.push(o); } },
      detectAllFaces: () => cadena,
    };
    const descriptor = await extraerDescriptor({}, faceapi);
    expect(descriptor).toHaveLength(128);
    expect(CONFIANZA_MINIMA_DETECCION).toBe(0.9);
    expect(opciones).toEqual([{ minConfidence: 0.9 }]);
  });
});
