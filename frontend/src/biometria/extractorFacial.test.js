import { describe, expect, it, vi } from 'vitest';
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

describe('Precarga y calentamiento de los modelos (RNF-01)', () => {
  const crearFaceApi = (llamadas) => ({
    nets: {
      ssdMobilenetv1: { loadFromUri: async () => { llamadas.push('ssd'); } },
      faceLandmark68Net: { loadFromUri: async () => { llamadas.push('landmarks'); } },
      faceRecognitionNet: { loadFromUri: async () => { llamadas.push('reconocimiento'); } },
    },
    SsdMobilenetv1Options: class { constructor(o) { this.o = o; } },
    detectAllFaces: async (_lienzo, opciones) => { llamadas.push(`detectar:${opciones.o.minConfidence}`); return []; },
    detectFaceLandmarks: async () => { llamadas.push('calentar-landmarks'); },
    computeFaceDescriptor: async () => { llamadas.push('calentar-descriptor'); },
  });

  it('carga los modelos una sola vez y ejecuta las tres redes con el mismo detector calibrado', async () => {
    vi.resetModules();
    const { prepararBiometria } = await import('./extractorFacial');
    const llamadas = [];
    const faceapi = crearFaceApi(llamadas);
    const cargar = vi.fn().mockResolvedValue(faceapi);

    const [a, b] = await Promise.all([prepararBiometria(cargar), prepararBiometria(cargar)]);

    expect(a).toBe(faceapi);
    expect(b).toBe(faceapi);
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(llamadas).toEqual(expect.arrayContaining(['ssd', 'landmarks', 'reconocimiento', 'detectar:0.9', 'calentar-landmarks', 'calentar-descriptor']));
  });

  it('si el calentamiento falla, igual devuelve la librería con los modelos cargados', async () => {
    vi.resetModules();
    const { prepararBiometria } = await import('./extractorFacial');
    const faceapi = { ...crearFaceApi([]), detectAllFaces: async () => { throw new Error('webgl'); } };
    await expect(prepararBiometria(async () => faceapi)).resolves.toBe(faceapi);
  });

  it('si la carga falla, permite reintentar', async () => {
    vi.resetModules();
    const { prepararBiometria } = await import('./extractorFacial');
    const cargar = vi.fn().mockRejectedValueOnce(new Error('red')).mockResolvedValue(crearFaceApi([]));
    await expect(prepararBiometria(cargar)).rejects.toThrow('red');
    await expect(prepararBiometria(cargar)).resolves.toBeTruthy();
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('detecta cuando TensorFlow.js calcula sin aceleración gráfica', async () => {
    const { sinAceleracionGrafica } = await import('./extractorFacial');
    expect(sinAceleracionGrafica({ tf: { getBackend: () => 'cpu' } })).toBe(true);
    expect(sinAceleracionGrafica({ tf: { getBackend: () => 'webgl' } })).toBe(false);
    expect(sinAceleracionGrafica({ tf: { getBackend: () => { throw new Error('x'); } } })).toBe(false);
    expect(sinAceleracionGrafica(null)).toBe(false);
  });
});
