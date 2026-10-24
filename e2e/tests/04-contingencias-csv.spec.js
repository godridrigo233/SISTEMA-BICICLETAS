import { test, expect } from '@playwright/test';
import { config, omitirSiFaltanCredenciales } from '../helpers/config.js';
import { iniciarSesion, cerrarSesion } from '../helpers/auth.js';

/**
 * Calcula la fecha y hora actual en zona horaria America/Lima restando 5 minutos,
 * con formato estricto dd/mm/aaaa hh:mm para evitar el rechazo por fecha futura en la API.
 */
function calcularFechaHoraLimaMenosCincoMinutos() {
  const fecha = new Date(Date.now() - 5 * 60 * 1000);
  const formateador = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const partes = formateador.formatToParts(fecha);
  const dia = partes.find((p) => p.type === 'day')?.value ?? '01';
  const mes = partes.find((p) => p.type === 'month')?.value ?? '01';
  const anio = partes.find((p) => p.type === 'year')?.value ?? '2026';
  const hora = partes.find((p) => p.type === 'hour')?.value ?? '00';
  const minuto = partes.find((p) => p.type === 'minute')?.value ?? '00';

  return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
}

test.describe('04 · Consola de Regularización - Importación y Conciliación CSV', () => {
  test('Importación de archivo CSV de garita y conciliación condicional según modo de escritura', async ({ page }) => {
    // La regularización de contingencias requiere rol Supervisor o Administrador
    const rolOperador = config.usuarios.supervisor.correo ? 'supervisor' : 'administrador';
    if (!omitirSiFaltanCredenciales(test, rolOperador)) return;

    await iniciarSesion(page, config.usuarios[rolOperador]);

    let tipoEvento = 'INGRESO';
    let dniEstudiante = '';

    // Si la escritura está habilitada, consultamos el estado actual de la bicicleta en garita
    // para evitar conflictos: si ya figura DENTRO se regulariza como RETIRO con su respectivo DNI
    if (config.permitirEscritura) {
      await page.goto('/garita/control-acceso');
      await page.locator('#qr').fill(config.datosPrueba.bicicletaQr);
      await page.getByRole('button', { name: /consultar/i }).click();

      const ficha = page.locator('section[aria-label="Bicicleta identificada"]');
      await expect(ficha).toBeVisible();

      const textoFicha = await ficha.textContent();
      if (textoFicha?.includes('DENTRO')) {
        tipoEvento = 'RETIRO';
        dniEstudiante = config.datosPrueba.estudianteDni;
      }
    }

    await page.goto('/supervisor/contingencias');
    await expect(page).toHaveURL(/.*\/supervisor\/contingencias/);
    await expect(page.getByRole('heading', { name: /consola de regularización/i })).toBeVisible();

    // Generación del archivo CSV de prueba con folio único y fecha calculada en hora de Lima
    const folioUnico = `E2E-${Date.now().toString().slice(-6)}`;
    const fechaHoraLima = calcularFechaHoraLimaMenosCincoMinutos();

    const contenidoCsv = [
      'folio;fecha_hora;tipo;codigo;dni;vigilante',
      `${folioUnico};${fechaHoraLima};${tipoEvento};${config.datosPrueba.bicicletaQr};${dniEstudiante};${config.datosPrueba.vigilanteCorreo}`,
      '',
    ].join('\n');

    // Carga del archivo CSV
    const inputCsv = page.locator('#csv');
    await expect(inputCsv).toBeVisible();
    await inputCsv.setInputFiles({
      name: `contingencia_${folioUnico}.csv`,
      mimeType: 'text/csv',
      buffer: Buffer.from(contenidoCsv, 'utf-8'),
    });

    // Verificación de la vista previa autocompletada
    await expect(page.getByRole('heading', { name: /vista previa/i })).toBeVisible({ timeout: 20000 });

    // Apertura del modal de confirmación «Importar y conciliar»
    const botonImportar = page.getByRole('button', { name: /importar y conciliar \d+ filas/i });
    await expect(botonImportar).toBeEnabled({ timeout: 15000 });
    await botonImportar.click();

    // Comprobación del modal y del resumen
    const modalConfirmacion = page.locator('section.ficha.modal[role="dialog"]');
    await expect(modalConfirmacion).toBeVisible();
    await expect(modalConfirmacion).toContainText(/¿importar y conciliar/i);

    // Modo solo lectura por defecto (piloto real)
    if (!config.permitirEscritura) {
      // Con false, se comprueba el resumen y se pulsa «Cancelar»
      const botonCancelarModal = modalConfirmacion.getByRole('button', { name: /cancelar/i });
      await expect(botonCancelarModal).toBeVisible();
      await botonCancelarModal.click();

      await expect(modalConfirmacion).not.toBeVisible();
      await cerrarSesion(page);
      return;
    }

    // Modo con escritura habilitada (solo permitido contra BD de prueba)
    const botonConfirmar = modalConfirmacion.getByRole('button', { name: /confirmar/i });
    await expect(botonConfirmar).toBeEnabled();
    await botonConfirmar.click();

    // Validación exacta: mensaje «Se importaron N filas y se procesó el lote» y 0 conflictos
    const avisoResultado = page.locator('main.contenido > p[role="status"], main.contenido > p[role="alert"]');
    await expect(avisoResultado).toBeVisible({ timeout: 25000 });
    await expect(avisoResultado).toContainText(/Se importaron \d+ filas y se procesó el lote/i);
    await expect(avisoResultado).toContainText(/0 conflictos/i);

    await cerrarSesion(page);
  });
});
