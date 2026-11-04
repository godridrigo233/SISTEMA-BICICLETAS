// Componente biométrico Edge: la detección del rostro y la extracción del descriptor de 128 valores
// ocurren en el navegador de la garita. No se capturan ni envían imágenes: solo el descriptor, que la
// API compara con el de referencia y descarta (Ley N.º 29733).
import { UMBRALES_CALIDAD, UMBRALES_ENROLAMIENTO, evaluarCalidad, medirBrillo, mensajeCalidad } from './calidadCaptura';

export const DIMENSIONES_DESCRIPTOR = 128;
const RUTA_MODELOS = '/models';
// Misma librería (@vladmandic/face-api 1.7.15, TensorFlow.js 4.22) y mismo detector (SSD MobileNetV1,
// confianza > 0.90) con los que se conformó el Dataset Primario Local UCSM y se calibró θ = 0.37.
// Cambiar la librería, el detector o los modelos exige recalibrar el umbral.
export const VERSION_MODELO = 'vlad-1.7.15-ssd';
export const CONFIANZA_MINIMA_DETECCION = 0.9;

export class ErrorBiometrico extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

/** Carga diferida de la librería facial: solo se descarga al abrir el flujo de retiro o de enrolamiento. */
export const obtenerFaceApi = () => import('@vladmandic/face-api');

let modelosCargados = null;
export function cargarModelos(faceapi) {
  modelosCargados ??= Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(RUTA_MODELOS),
    faceapi.nets.faceLandmark68Net.loadFromUri(RUTA_MODELOS),
    faceapi.nets.faceRecognitionNet.loadFromUri(RUTA_MODELOS),
  ]).catch((error) => {
    modelosCargados = null;
    throw error;
  });
  return modelosCargados;
}

/**
 * Precarga y calentamiento (RNF-01): descarga los modelos y ejecuta una vez las tres redes sobre un lienzo
 * vacío para que la tarjeta gráfica compile sus programas antes de que llegue el titular. Así, la primera
 * captura real ya no incluye la descarga ni la compilación. No cambia el detector, el modelo ni θ.
 * Es idempotente: la promesa se comparte entre pantallas y se reintenta si falla.
 */
let preparacion = null;
export function prepararBiometria(cargarLibreria = obtenerFaceApi) {
  preparacion ??= (async () => {
    const faceapi = await cargarLibreria();
    await cargarModelos(faceapi);
    try {
      const lienzo = document.createElement('canvas');
      lienzo.width = 150;
      lienzo.height = 150;
      await faceapi.detectAllFaces(lienzo, new faceapi.SsdMobilenetv1Options({ minConfidence: CONFIANZA_MINIMA_DETECCION }));
      await faceapi.detectFaceLandmarks(lienzo);
      await faceapi.computeFaceDescriptor(lienzo);
    } catch {
      // El calentamiento es una optimización: si falla, la captura real sigue funcionando.
    }
    return faceapi;
  })().catch((error) => {
    preparacion = null;
    throw error;
  });
  return preparacion;
}

/** Devuelve true si TensorFlow.js calcula sin aceleración gráfica (backend «cpu»): la verificación será lenta. */
export function sinAceleracionGrafica(faceapi) {
  try {
    return faceapi?.tf?.getBackend?.() === 'cpu';
  } catch {
    return false;
  }
}

/** CU-04, flujo 3a: se exige exactamente un rostro en el encuadre. */
export function seleccionarRostroUnico(rostros) {
  if (!rostros?.length) {
    throw new ErrorBiometrico('NO_ROSTRO', 'No se detectó el rostro con claridad. Mejore la posición o la iluminación y repita la captura.');
  }
  if (rostros.length > 1) {
    throw new ErrorBiometrico('VARIOS_ROSTROS', 'Hay más de un rostro en el encuadre. Solo debe aparecer el titular.');
  }
  const descriptor = Array.from(rostros[0].descriptor);
  if (descriptor.length !== DIMENSIONES_DESCRIPTOR) {
    throw new ErrorBiometrico('DESCRIPTOR_INVALIDO', 'El descriptor obtenido no es válido. Repita la captura.');
  }
  return descriptor;
}

export async function extraerDescriptor(video, faceapi) {
  await cargarModelos(faceapi);
  const rostros = await faceapi
    .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: CONFIANZA_MINIMA_DETECCION }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  return seleccionarRostroUnico(rostros);
}

/**
 * Cámara a 1280 × 720 cuando el equipo lo permite (antes, el valor por defecto del navegador, por lo general
 * 640 × 480): el rostro llega al detector con más detalle. El video se procesa solo en memoria.
 */
export const RESTRICCIONES_CAMARA = Object.freeze({
  video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
});
export const abrirCamara = () => navigator.mediaDevices.getUserMedia(RESTRICCIONES_CAMARA);

/** Evalúa la calidad del único rostro del encuadre (o informa NO_ROSTRO / VARIOS_ROSTROS). */
export function evaluarEncuadre(rostros, video, { umbrales = UMBRALES_CALIDAD, brillo = medirBrillo } = {}) {
  if (!rostros?.length) return { apta: false, problema: 'NO_ROSTRO', metricas: {} };
  if (rostros.length > 1) return { apta: false, problema: 'VARIOS_ROSTROS', metricas: {} };
  const caja = rostros[0].detection?.box;
  const puntos = rostros[0].landmarks?.positions;
  if (!caja || !puntos) return { apta: true, problema: null, metricas: {} };
  return evaluarCalidad(
    { caja, puntos, anchoVideo: video?.videoWidth ?? 0, altoVideo: video?.videoHeight ?? 0, brillo: brillo(video, caja) },
    umbrales,
  );
}

const esperarMs = (ms) => new Promise((resolver) => { setTimeout(resolver, ms); });

/**
 * Captura automática: analiza el video cada `intervaloMs` y solo calcula el descriptor cuando el rostro cumple
 * el control de calidad durante `cuadrosEstables` análisis seguidos (≈ 1 s), lo que evita capturar en pleno
 * movimiento. Informa cada análisis con `alCambiar` para guiar a quien mira la pantalla. Si en
 * `tiempoMaximoMs` no se logra una captura apta, falla con TIEMPO_AGOTADO y el último problema detectado.
 * `inicioCaptura` marca el inicio del cálculo del descriptor: la espera previa no cuenta en la latencia (RNF-01).
 */
export async function capturarAutomaticamente(video, faceapi, opciones = {}) {
  const {
    destinatario = 'vigilante',
    umbrales = UMBRALES_CALIDAD,
    cuadrosEstables = 5,
    intervaloMs = 200,
    tiempoMaximoMs = 10000,
    alCambiar = () => {},
    senal,
    ahora = () => performance.now(),
    esperar = esperarMs,
    brillo = medirBrillo,
  } = opciones;
  await cargarModelos(faceapi);
  const detector = new faceapi.SsdMobilenetv1Options({ minConfidence: CONFIANZA_MINIMA_DETECCION });
  const comienzo = ahora();
  let estables = 0;
  let ultimoProblema = 'NO_ROSTRO';
  for (;;) {
    if (senal?.aborted) throw new ErrorBiometrico('CANCELADO', 'Captura cancelada.');
    if (ahora() - comienzo > tiempoMaximoMs) {
      throw new ErrorBiometrico('TIEMPO_AGOTADO', mensajeCalidad(ultimoProblema, destinatario));
    }
    const rostros = await faceapi.detectAllFaces(video, detector).withFaceLandmarks();
    if (senal?.aborted) throw new ErrorBiometrico('CANCELADO', 'Captura cancelada.');
    const evaluacion = evaluarEncuadre(rostros, video, { umbrales, brillo });
    if (evaluacion.apta) {
      estables += 1;
    } else {
      estables = 0;
      ultimoProblema = evaluacion.problema;
    }
    alCambiar({
      apta: evaluacion.apta,
      problema: evaluacion.problema,
      mensaje: evaluacion.apta ? 'Rostro en posición. Manténgalo así un momento…' : mensajeCalidad(evaluacion.problema, destinatario),
      estables,
      cuadrosEstables,
    });
    if (estables >= cuadrosEstables) {
      const inicioCaptura = ahora();
      const completos = await faceapi.detectAllFaces(video, detector).withFaceLandmarks().withFaceDescriptors();
      const final = evaluarEncuadre(completos, video, { umbrales, brillo });
      if (final.apta) return { descriptor: seleccionarRostroUnico(completos), inicioCaptura, metricas: final.metricas };
      estables = 0;
      ultimoProblema = final.problema;
    }
    await esperar(intervaloMs);
  }
}

/** Distancia euclidiana entre dos descriptores (solo para comparar dos capturas del propio titular). */
export function distanciaEuclidiana(a, b) {
  let suma = 0;
  for (let i = 0; i < a.length; i += 1) suma += (a[i] - b[i]) ** 2;
  return Math.sqrt(suma);
}

/**
 * Dos capturas del mismo titular, tomadas con segundos de diferencia, deben parecerse mucho entre sí. Si no,
 * alguna salió mal (alineación o pose) y no debe usarse como referencia. Valor prudente, muy inferior a θ.
 */
export const DISTANCIA_MAXIMA_CONSISTENCIA = 0.25;

/**
 * Enrolamiento (CU-01): dos capturas automáticas con el control de calidad más exigente. Solo se acepta si son
 * consistentes entre sí; se conserva la primera como referencia (una única captura, igual que en la calibración
 * de θ) y la segunda se descarta tras la comparación.
 */
export async function capturarParaEnrolamiento(video, faceapi, opciones = {}) {
  const { alCambiar = () => {}, esperar = esperarMs, pausaMs = 1000 } = opciones;
  const base = { ...opciones, destinatario: 'titular', umbrales: opciones.umbrales ?? UMBRALES_ENROLAMIENTO };
  const primera = await capturarAutomaticamente(video, faceapi, { ...base, alCambiar: (e) => alCambiar({ ...e, captura: 1 }) });
  alCambiar({ apta: true, problema: null, mensaje: 'Primera captura lista. Siga mirando de frente a la cámara…', estables: 0, cuadrosEstables: 5, captura: 2 });
  await esperar(pausaMs);
  const segunda = await capturarAutomaticamente(video, faceapi, { ...base, alCambiar: (e) => alCambiar({ ...e, captura: 2 }) });
  const diferencia = distanciaEuclidiana(primera.descriptor, segunda.descriptor);
  segunda.descriptor.fill(0);
  if (diferencia > DISTANCIA_MAXIMA_CONSISTENCIA) {
    primera.descriptor.fill(0);
    throw new ErrorBiometrico(
      'CAPTURAS_INCONSISTENTES',
      'Las dos capturas no coinciden lo suficiente. Repita la captura mirando de frente, quieto y con buena iluminación.',
    );
  }
  return primera.descriptor;
}
