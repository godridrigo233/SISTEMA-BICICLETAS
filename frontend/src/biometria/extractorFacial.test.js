import { describe, expect, it, vi } from 'vitest';
import {
  CONFIANZA_MINIMA_DETECCION, DIMENSIONES_DESCRIPTOR, DISTANCIA_MAXIMA_CONSISTENCIA, ErrorBiometrico, RESTRICCIONES_CAMARA, VERSION_MODELO,
  capturarAutomaticamente, capturarParaEnrolamiento, distanciaEuclidiana, extraerDescriptor, seleccionarRostroUnico,
} from './extractorFacial';

/** 68 puntos de un rostro frontal sintético; `narizX` desplaza la nariz para simular el giro lateral. */
function puntosSinteticos({ narizX = 200 } = {}) {
  const puntos = Array.from({ length: 68 }, () => ({ x: 200, y: 230 }));
  puntos[0] = { x: 120, y: 200 };
  puntos[16] = { x: 280, y: 200 };
  puntos[8] = { x: 200, y: 300 };
  for (let i = 36; i < 42; i += 1) puntos[i] = { x: 165, y: 170 };
  for (let i = 42; i < 48; i += 1) puntos[i] = { x: 235, y: 170 };
  puntos[30] = { x: narizX, y: 215 };
  return puntos;
}

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
  it('identifica la librería y el detector de la Fase A (@vladmandic/face-api 1.7.15 con SSD MobileNetV1)', () => {
    expect(VERSION_MODELO).toBe('vlad-1.7.15-ssd');
    expect(VERSION_MODELO.length).toBeLessThanOrEqual(20);   // columna version_modelo VARCHAR(20)
  });

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

describe('Captura automática con control de calidad', () => {
  const caja = { x: 230, y: 130, width: 180, height: 220 };
  const video = { videoWidth: 640, videoHeight: 480 };
  const descriptorDe = (v) => new Float32Array(128).fill(v);
  const apto = (v = 0.1) => ({ detection: { box: caja }, landmarks: { positions: puntosSinteticos() }, descriptor: descriptorDe(v) });
  const girado = () => ({ detection: { box: caja }, landmarks: { positions: puntosSinteticos({ narizX: 250 }) }, descriptor: descriptorDe(0.1) });

  /** faceapi falso: cada análisis toma el siguiente encuadre de `secuencia`; la captura final usa `final()`. */
  function crearFaceApi(secuencia, final = () => [apto()]) {
    const opciones = [];
    let i = 0;
    const faceapi = {
      nets: {
        ssdMobilenetv1: { loadFromUri: async () => {} },
        faceLandmark68Net: { loadFromUri: async () => {} },
        faceRecognitionNet: { loadFromUri: async () => {} },
      },
      SsdMobilenetv1Options: class { constructor(o) { opciones.push(o); } },
      detectAllFaces: () => ({
        withFaceLandmarks: () => {
          const actual = secuencia[Math.min(i, secuencia.length - 1)];
          const promesa = Promise.resolve(actual);
          promesa.withFaceDescriptors = async () => final();
          i += 1;
          return promesa;
        },
      }),
    };
    return { faceapi, opciones, analisis: () => i };
  }
  const reloj = () => { let t = 0; return { ahora: () => t, esperar: async (ms) => { t += ms; } }; };
  const comun = { brillo: () => 130 };

  it('captura solo tras 5 análisis aptos seguidos y reinicia la cuenta si el rostro se gira', async () => {
    const secuencia = [[apto()], [apto()], [girado()], [apto()], [apto()], [apto()], [apto()], [apto()]];
    const { faceapi, opciones } = crearFaceApi(secuencia);
    const estados = [];
    const r = await capturarAutomaticamente(video, faceapi, { ...comun, ...reloj(), alCambiar: (e) => estados.push(e) });
    expect(r.descriptor).toHaveLength(128);
    expect(typeof r.inicioCaptura).toBe('number');
    expect(estados.map((e) => e.estables)).toEqual([1, 2, 0, 1, 2, 3, 4, 5]);
    expect(estados[2].mensaje).toBe('Pida al estudiante que mire de frente a la cámara.');
    expect(opciones[0]).toEqual({ minConfidence: 0.9 });
  });

  it('agota el tiempo con el último problema detectado y no envía nada', async () => {
    const { faceapi } = crearFaceApi([[]]);
    await expect(capturarAutomaticamente(video, faceapi, { ...comun, ...reloj(), tiempoMaximoMs: 1000 }))
      .rejects.toMatchObject({ codigo: 'TIEMPO_AGOTADO', message: 'Oriente la cámara hacia el rostro del estudiante.' });
  });

  it('se detiene al cancelar (por ejemplo, al cerrar la verificación)', async () => {
    const control = new AbortController();
    const { faceapi } = crearFaceApi([[girado()]]);
    const promesa = capturarAutomaticamente(video, faceapi, { ...comun, ...reloj(), senal: control.signal });
    control.abort();
    await expect(promesa).rejects.toMatchObject({ codigo: 'CANCELADO' });
  });

  it('el enrolamiento acepta dos capturas consistentes y conserva una sola', async () => {
    let n = 0;
    const { faceapi } = crearFaceApi([[apto()]], () => [apto(n++ === 0 ? 0.1 : 0.105)]);
    const descriptor = await capturarParaEnrolamiento(video, faceapi, { ...comun, ...reloj() });
    expect(descriptor).toHaveLength(128);
    expect(descriptor[0]).toBeCloseTo(0.1, 5);
  });

  it('el enrolamiento rechaza dos capturas que no coinciden entre sí', async () => {
    let n = 0;
    const { faceapi } = crearFaceApi([[apto()]], () => [apto(n++ === 0 ? 0.1 : 0.2)]);
    await expect(capturarParaEnrolamiento(video, faceapi, { ...comun, ...reloj() }))
      .rejects.toMatchObject({ codigo: 'CAPTURAS_INCONSISTENTES' });
    expect(distanciaEuclidiana(descriptorDe(0.1), descriptorDe(0.2))).toBeGreaterThan(DISTANCIA_MAXIMA_CONSISTENCIA);
    expect(DISTANCIA_MAXIMA_CONSISTENCIA).toBeLessThan(0.37);
  });

  it('pide la cámara a 1280 × 720 cuando el equipo lo permite', () => {
    expect(RESTRICCIONES_CAMARA.video).toMatchObject({ facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } });
    expect(RESTRICCIONES_CAMARA.audio).toBe(false);
  });
});
