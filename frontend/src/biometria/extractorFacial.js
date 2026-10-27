// Componente biométrico Edge: la detección del rostro y la extracción del descriptor de 128 valores
// ocurren en el navegador de la garita. No se capturan ni envían imágenes: solo el descriptor, que la
// API compara con el de referencia y descarta (Ley N.º 29733).
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
