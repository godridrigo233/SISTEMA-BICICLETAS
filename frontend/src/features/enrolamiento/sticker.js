import QRCode from 'qrcode';

/** «Juan Carlos» + «Pérez Ramos» → «J. Pérez R.» (el sticker no muestra el nombre completo). */
export function nombreAbreviado(nombres, apellidos) {
  const [paterno = '', materno = ''] = apellidos.trim().split(/\s+/);
  const inicial = nombres.trim().charAt(0);
  const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  return `${inicial.toUpperCase()}. ${capital(paterno)}${materno ? ` ${materno.charAt(0).toUpperCase()}.` : ''}`;
}

export const qrComoDataUrl = (codigoQr) => QRCode.toDataURL(codigoQr, { width: 320, margin: 1, errorCorrectionLevel: 'M' });

/** Genera el sticker (QR + nombre abreviado + rótulo UCSM) como imagen PNG descargable. */
export async function descargarSticker(codigoQr, nombre) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 400;
  lienzo.height = 480;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 400, 480);
  ctx.fillStyle = '#00693e';
  ctx.fillRect(0, 0, 400, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('UCSM · Control de bicicletas', 200, 36);
  const qr = new Image();
  qr.src = await qrComoDataUrl(codigoQr);
  await qr.decode();
  ctx.drawImage(qr, 40, 70, 320, 320);
  ctx.fillStyle = '#222222';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(nombre, 200, 430);
  const enlace = document.createElement('a');
  enlace.href = lienzo.toDataURL('image/png');
  enlace.download = `sticker-qr-${codigoQr.slice(0, 8)}.png`;
  enlace.click();
}
