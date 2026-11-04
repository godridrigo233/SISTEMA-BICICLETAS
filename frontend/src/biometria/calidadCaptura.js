// Control de calidad de la captura facial (Edge). Decide si un fotograma es apto ANTES de calcular y enviar el
// descriptor, a partir de la caja del rostro y de los 68 puntos faciales que el propio flujo ya calcula.
// No modifica el detector (SSD MobileNetV1, confianza ≥ 0.90), los modelos ni el umbral θ = 0.37: solo
// evita enviar capturas de baja calidad (rostro girado, lejano, descentrado o con mala iluminación).
// Ningún fotograma se guarda: la medición del brillo usa un lienzo de 32 × 32 en memoria que se limpia al terminar.

export const UMBRALES_CALIDAD = Object.freeze({
  anchoMinimoPx: 90, // ancho mínimo de la caja del rostro, en píxeles del video
  proporcionMinima: 0.12, // ancho del rostro / ancho del video: por debajo, el rostro está lejos (≈ 1 m o más)
  proporcionMaxima: 0.75, // por encima, el rostro está demasiado cerca
  desvioMaximoCentro: 0.25, // desplazamiento máximo del centro del rostro respecto del centro del encuadre
  simetriaMinima: 0.6, // giro lateral: distancia nariz–mandíbula menor / mayor
  cabeceoMinimo: 0.2, // cabeceo: (nariz − ojos) / (mentón − ojos)
  cabeceoMaximo: 0.55,
  inclinacionMaxima: 15, // grados de la línea de los ojos
  brilloMinimo: 60, // luminancia media del rostro (0–255)
  brilloMaximo: 210,
});

/** El enrolamiento genera la referencia de todos los retiros: se exige una pose más frontal. */
export const UMBRALES_ENROLAMIENTO = Object.freeze({
  ...UMBRALES_CALIDAD,
  simetriaMinima: 0.7,
  inclinacionMaxima: 10,
});

const MENSAJES = {
  vigilante: {
    NO_ROSTRO: 'Oriente la cámara hacia el rostro del estudiante.',
    VARIOS_ROSTROS: 'Hay más de un rostro en el encuadre. Pida que solo el titular quede frente a la cámara.',
    MUY_LEJOS: 'Pida al estudiante que se acerque a la cámara.',
    MUY_CERCA: 'Pida al estudiante que se aleje un poco de la cámara.',
    FUERA_DE_CENTRO: 'Centre el rostro del estudiante dentro del óvalo.',
    NO_DE_FRENTE: 'Pida al estudiante que mire de frente a la cámara.',
    INCLINADO: 'Pida al estudiante que mantenga la cabeza recta.',
    POCA_LUZ: 'Falta luz en el rostro: evite el contraluz o mejore la iluminación.',
    MUCHA_LUZ: 'Hay demasiada luz en el rostro: evite la luz directa sobre la cámara.',
  },
  titular: {
    NO_ROSTRO: 'Ubique su rostro frente a la cámara.',
    VARIOS_ROSTROS: 'Hay más de un rostro en el encuadre. Solo usted debe aparecer.',
    MUY_LEJOS: 'Acérquese a la cámara.',
    MUY_CERCA: 'Aléjese un poco de la cámara.',
    FUERA_DE_CENTRO: 'Centre su rostro dentro del óvalo.',
    NO_DE_FRENTE: 'Mire de frente a la cámara.',
    INCLINADO: 'Mantenga la cabeza recta.',
    POCA_LUZ: 'Falta luz en su rostro: evite el contraluz o busque un lugar más iluminado.',
    MUCHA_LUZ: 'Hay demasiada luz en su rostro: evite la luz directa.',
  },
};

export const CODIGOS_CALIDAD = Object.freeze(Object.keys(MENSAJES.vigilante));

/** Mensaje en lenguaje llano para quien mira la pantalla: el vigilante (retiro) o el titular (enrolamiento). */
export function mensajeCalidad(codigo, destinatario = 'vigilante') {
  const mensajes = MENSAJES[destinatario] ?? MENSAJES.vigilante;
  return mensajes[codigo] ?? mensajes.NO_ROSTRO;
}

const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const promedio = (puntos) => ({
  x: puntos.reduce((s, p) => s + p.x, 0) / puntos.length,
  y: puntos.reduce((s, p) => s + p.y, 0) / puntos.length,
});

/**
 * Evalúa un rostro detectado. `caja`: {x, y, width, height}; `puntos`: los 68 puntos faciales (iBUG 300-W);
 * `brillo`: luminancia media del rostro o null si no se pudo medir. Devuelve el primer problema en orden de
 * prioridad, que es el que se comunica en pantalla.
 */
export function evaluarCalidad({ caja, puntos, anchoVideo = 0, altoVideo = 0, brillo = null }, umbrales = UMBRALES_CALIDAD) {
  const problemas = [];
  const metricas = {};

  if (caja && anchoVideo > 0 && altoVideo > 0) {
    metricas.anchoRostroPx = caja.width;
    metricas.proporcion = caja.width / anchoVideo;
    if (caja.width < umbrales.anchoMinimoPx || metricas.proporcion < umbrales.proporcionMinima) problemas.push('MUY_LEJOS');
    else if (metricas.proporcion > umbrales.proporcionMaxima) problemas.push('MUY_CERCA');

    metricas.desvioX = Math.abs(caja.x + caja.width / 2 - anchoVideo / 2) / anchoVideo;
    metricas.desvioY = Math.abs(caja.y + caja.height / 2 - altoVideo / 2) / altoVideo;
    const cortado = caja.x < 0 || caja.y < 0 || caja.x + caja.width > anchoVideo || caja.y + caja.height > altoVideo;
    if (cortado || metricas.desvioX > umbrales.desvioMaximoCentro || metricas.desvioY > umbrales.desvioMaximoCentro) {
      problemas.push('FUERA_DE_CENTRO');
    }
  }

  if (puntos?.length === 68) {
    const ojoIzquierdo = promedio(puntos.slice(36, 42));
    const ojoDerecho = promedio(puntos.slice(42, 48));
    const ojos = promedio([ojoIzquierdo, ojoDerecho]);
    const nariz = puntos[30];
    const menton = puntos[8];

    const aIzquierda = distancia(nariz, puntos[0]);
    const aDerecha = distancia(nariz, puntos[16]);
    metricas.simetria = Math.min(aIzquierda, aDerecha) / Math.max(aIzquierda, aDerecha);
    const altoCara = menton.y - ojos.y;
    metricas.cabeceo = altoCara > 0 ? (nariz.y - ojos.y) / altoCara : 0;
    if (
      metricas.simetria < umbrales.simetriaMinima
      || metricas.cabeceo < umbrales.cabeceoMinimo
      || metricas.cabeceo > umbrales.cabeceoMaximo
    ) {
      problemas.push('NO_DE_FRENTE');
    }

    let inclinacion = Math.abs((Math.atan2(ojoDerecho.y - ojoIzquierdo.y, ojoDerecho.x - ojoIzquierdo.x) * 180) / Math.PI);
    if (inclinacion > 90) inclinacion = 180 - inclinacion; // video espejado
    metricas.inclinacion = inclinacion;
    if (inclinacion > umbrales.inclinacionMaxima) problemas.push('INCLINADO');
  }

  if (typeof brillo === 'number') {
    metricas.brillo = brillo;
    if (brillo < umbrales.brilloMinimo) problemas.push('POCA_LUZ');
    else if (brillo > umbrales.brilloMaximo) problemas.push('MUCHA_LUZ');
  }

  return { apta: problemas.length === 0, problema: problemas[0] ?? null, problemas, metricas };
}

/**
 * Luminancia media de la zona del rostro. Reduce la región a 32 × 32 en un lienzo en memoria y lo limpia al
 * terminar: no se conserva ninguna imagen. Devuelve null si el navegador no permite leer el lienzo.
 */
export function medirBrillo(fuente, caja, lienzo) {
  try {
    const destino = lienzo ?? document.createElement('canvas');
    destino.width = 32;
    destino.height = 32;
    const contexto = destino.getContext('2d', { willReadFrequently: true });
    if (!contexto) return null;
    contexto.drawImage(fuente, caja.x, caja.y, caja.width, caja.height, 0, 0, 32, 32);
    const { data } = contexto.getImageData(0, 0, 32, 32);
    let suma = 0;
    for (let i = 0; i < data.length; i += 4) suma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    contexto.clearRect(0, 0, 32, 32);
    return suma / (data.length / 4);
  } catch {
    return null;
  }
}
