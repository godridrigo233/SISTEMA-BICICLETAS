// Componente biométrico Edge: la detección del rostro y la extracción del descriptor de 128 valores
// ocurren en el navegador de la garita. No se capturan ni envían imágenes: solo el descriptor, que la
// API compara con el de referencia y descarta (Ley N.º 29733).
export const DIMENSIONES_DESCRIPTOR = 128;
const RUTA_MODELOS = '/models';

export class ErrorBiometrico extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

/** Carga diferida de face-api.js: la librería solo se descarga al abrir el flujo de retiro. */
export const obtenerFaceApi = () => import('face-api.js');

let modelosCargados = null;
export function cargarModelos(faceapi) {
  modelosCargados ??= Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(RUTA_MODELOS),
    faceapi.nets.faceLandmark68Net.loadFromUri(RUTA_MODELOS),
    faceapi.nets.faceRecognitionNet.loadFromUri(RUTA_MODELOS),
  ]).catch((error) => {
    modelosCargados = null;
    throw error;
  });
  return modelosCargados;
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
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  return seleccionarRostroUnico(rostros);
}
