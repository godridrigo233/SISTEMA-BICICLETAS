// Ayudas de adquisición de la cámara y de la pantalla para mejorar la iluminación del rostro.
// Actúan sobre la cámara (exposición) y la pantalla (mantenerla encendida), no sobre la imagen: el fotograma
// llega al detector sin procesar, igual que en la calibración de θ = 0.37. Ninguna se puede exigir al
// navegador; si no están disponibles, la captura continúa sin ellas.

/** Luminancia media del rostro que se busca al ajustar la exposición (escala 0–255). */
export const BRILLO_OBJETIVO = 120;
const MARGEN = 15;
const ESPERA_ENTRE_AJUSTES_MS = 700;

/**
 * Crea un ajuste automático de la exposición para la pista de video. Cada vez que se le entrega el brillo medido
 * del rostro, sube (o baja) un paso la compensación de exposición —o, si la cámara no la ofrece, el brillo— hasta
 * acercarse a `BRILLO_OBJETIVO`. Solo funciona en navegadores y cámaras que exponen esos controles (p. ej.,
 * Chrome con muchas webcams); en los demás devuelve una función que no hace nada.
 */
export function crearAjusteExposicion(pista, { ahora = () => Date.now() } = {}) {
  const capacidades = pista?.getCapabilities?.() ?? {};
  const control = ['exposureCompensation', 'brightness'].find((nombre) => capacidades[nombre]?.max > capacidades[nombre]?.min);
  if (!control || typeof pista.applyConstraints !== 'function') return Object.assign(() => false, { disponible: false });

  const { min, max } = capacidades[control];
  const paso = capacidades[control].step > 0 ? Math.max(capacidades[control].step, (max - min) / 20) : (max - min) / 20;
  let valor = pista.getSettings?.()[control] ?? (min + max) / 2;
  let ultimoAjuste = -Infinity;
  let enCurso = false;

  // Que la cámara mantenga la exposición automática como base, cuando lo permite.
  if (capacidades.exposureMode?.includes?.('continuous')) {
    void pista.applyConstraints({ advanced: [{ exposureMode: 'continuous' }] }).catch(() => {});
  }

  const ajustar = (brillo) => {
    if (typeof brillo !== 'number' || enCurso || ahora() - ultimoAjuste < ESPERA_ENTRE_AJUSTES_MS) return false;
    let siguiente = valor;
    if (brillo < BRILLO_OBJETIVO - MARGEN) siguiente = Math.min(max, valor + paso);
    else if (brillo > BRILLO_OBJETIVO + MARGEN * 3) siguiente = Math.max(min, valor - paso);
    if (siguiente === valor) return false;
    enCurso = true;
    ultimoAjuste = ahora();
    pista
      .applyConstraints({ advanced: [{ [control]: siguiente }] })
      .then(() => { valor = siguiente; })
      .catch(() => {})
      .finally(() => { enCurso = false; });
    return true;
  };
  return Object.assign(ajustar, { disponible: true, control });
}

/**
 * Mantiene la pantalla encendida y sin atenuarse mientras la cámara está activa (Screen Wake Lock). Evita que una
 * laptop con batería baje el brillo durante la verificación. Devuelve una función para liberarla.
 */
export async function mantenerPantallaEncendida() {
  try {
    const bloqueo = await navigator.wakeLock?.request?.('screen');
    return () => { void bloqueo?.release?.().catch(() => {}); };
  } catch {
    return () => {};
  }
}
