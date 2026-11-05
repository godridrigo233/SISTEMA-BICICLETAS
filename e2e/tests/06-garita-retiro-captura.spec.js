import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, omitirSiFaltanCredenciales } from '../helpers/config.js';
import { iniciarSesion, cerrarSesion } from '../helpers/auth.js';

/**
 * 06 · Retiro con captura automática (CU-04) usando una cámara simulada.
 *
 * Chromium reproduce un video con un rostro como si fuera la cámara. Se verifica la parte del navegador
 * (Edge): espera a que la cámara esté lista, control de calidad, captura automática sin clic y envío de un
 * descriptor de 128 valores sin imágenes. La solicitud a la API se intercepta y se responde con un resultado
 * simulado, de modo que NO se escribe en auditoria_accesos (la prueba es de solo lectura en el piloto).
 *
 * Video: E2E_VIDEO_ROSTRO (archivo .y4m o .mjpeg) o, si no se define, se genera con ffmpeg a partir de una
 * imagen de demostración pública de la librería facial. Ningún rostro se versiona en el repositorio.
 */
const raiz = dirname(fileURLToPath(import.meta.url));
const imagenDemo = resolve(raiz, '../../frontend/node_modules/@vladmandic/face-api/demo/sample6.jpg');
const videoGenerado = resolve(raiz, '../.cache/rostro-demo.y4m');

function prepararVideo() {
  if (process.env.E2E_VIDEO_ROSTRO) return existsSync(process.env.E2E_VIDEO_ROSTRO) ? process.env.E2E_VIDEO_ROSTRO : null;
  if (existsSync(videoGenerado)) return videoGenerado;
  if (!existsSync(imagenDemo)) return null;
  try {
    mkdirSync(dirname(videoGenerado), { recursive: true });
    execFileSync('ffmpeg', [
      '-loglevel', 'error', '-y', '-loop', '1', '-i', imagenDemo, '-t', '2', '-r', '15',
      '-vf', 'crop=430:530:1060:170,scale=-2:560,pad=1280:720:(ow-iw)/2:(oh-ih)/2:gray',
      '-pix_fmt', 'yuv420p', videoGenerado,
    ]);
    return videoGenerado;
  } catch {
    return null;
  }
}

const video = prepararVideo();

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      // Equipos sin GPU (contenedores, CI): WebGL por software para que la librería facial funcione.
      '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader',
      ...(video ? [`--use-file-for-fake-video-capture=${video}`] : []),
    ],
  },
});

test.describe('06 · Retiro con captura automática y cámara simulada', () => {
  test.setTimeout(180000);

  test('captura sola al detectar un rostro apto y envía solo el descriptor de 128 valores', async ({ page }) => {
    test.skip(!video, 'Sin video de rostro: defina E2E_VIDEO_ROSTRO o instale ffmpeg y las dependencias del frontend.');
    const rolOperador = config.usuarios.garitero.correo ? 'garitero' : 'supervisor';
    if (!omitirSiFaltanCredenciales(test, rolOperador)) return;

    // La decisión de la API se simula: no se registra ningún intento en la auditoría del piloto.
    let cuerpo = null;
    await page.route('**/retiros/autorizar', async (ruta) => {
      cuerpo = ruta.request().postDataJSON();
      await ruta.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resultado: 'DENEGADO', estadoActualizado: 'DENTRO', distanciaEuclidiana: 0.68, umbralTheta: 0.37 }),
      });
    });

    await iniciarSesion(page, config.usuarios[rolOperador]);
    await page.locator('#qr').fill(config.datosPrueba.bicicletaQr);
    await page.getByRole('button', { name: /consultar/i }).click();
    const ficha = page.locator('section[aria-label="Bicicleta identificada"]');
    await expect(ficha).toBeVisible();
    test.skip(!(await ficha.textContent())?.includes('DENTRO'), 'La bicicleta de prueba figura FUERA: el retiro no aplica en modo de solo lectura.');

    const verificacion = page.locator('section[aria-label="Verificación facial del retiro"]');
    await expect(verificacion.getByText(/Captura automática:/)).toBeVisible({ timeout: 90000 });

    // Sin hacer clic: la captura automática envía el descriptor cuando el rostro cumple el control de calidad.
    await expect(verificacion.getByText(/Retiro denegado/)).toBeVisible({ timeout: 150000 });
    expect(cuerpo).not.toBeNull();
    expect(cuerpo.descriptorCapturado).toHaveLength(128);
    expect(cuerpo.descriptorCapturado.every((v) => typeof v === 'number' && Number.isFinite(v))).toBe(true);
    expect(Object.keys(cuerpo).sort()).toEqual(['descriptorCapturado', 'idBicicleta', 'latenciaMs']);
    expect(cuerpo.latenciaMs).toBeGreaterThanOrEqual(0);

    await cerrarSesion(page);
  });
});
