import { test, expect } from '@playwright/test';
import { config, omitirSiFaltanCredenciales } from '../helpers/config.js';
import { iniciarSesion, cerrarSesion } from '../helpers/auth.js';

test.describe('04 · Consola de Regularización - Importación y Conciliación CSV', () => {
  test('Importación de archivo CSV de garita y conciliación en lote', async ({ page }) => {
    // La regularización de contingencias requiere rol Supervisor o Administrador
    const rolOperador = config.usuarios.supervisor.correo ? 'supervisor' : 'administrador';
    if (!omitirSiFaltanCredenciales(test, rolOperador)) return;

    await iniciarSesion(page, config.usuarios[rolOperador]);
    await page.goto('/supervisor/contingencias');
    await expect(page).toHaveURL(/.*\/supervisor\/contingencias/);
    await expect(page.getByRole('heading', { name: /consola de regularización/i })).toBeVisible();

    // Generación de un folio único y marca de tiempo actual para evitar rechazo por duplicados
    const ahora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fechaHora = `${pad(ahora.getDate())}/${pad(ahora.getMonth() + 1)}/${ahora.getFullYear()} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`;
    const folioUnico = `E2E-${Date.now().toString().slice(-6)}`;

    const contenidoCsv = [
      'folio;fecha_hora;tipo;codigo;dni;vigilante',
      `${folioUnico};${fechaHora};INGRESO;${config.datosPrueba.bicicletaQr};;${config.datosPrueba.vigilanteCorreo}`,
      '',
    ].join('\n');

    // Carga del archivo CSV de prueba
    const inputCsv = page.locator('#csv');
    await expect(inputCsv).toBeVisible();
    await inputCsv.setInputFiles({
      name: `contingencia_${folioUnico}.csv`,
      mimeType: 'text/csv',
      buffer: Buffer.from(contenidoCsv, 'utf-8'),
    });

    // Esperar la vista previa autocompletada
    await expect(page.getByRole('heading', { name: /vista previa/i })).toBeVisible({ timeout: 20000 });

    // Localizar botón de importación y conciliación
    const botonImportar = page.getByRole('button', { name: /importar y conciliar \d+ filas/i });
    await expect(botonImportar).toBeEnabled({ timeout: 15000 });
    await botonImportar.click();

    // Diálogo modal de confirmación única
    const modalConfirmacion = page.locator('section.ficha.modal[role="dialog"]');
    await expect(modalConfirmacion).toBeVisible();
    await expect(modalConfirmacion).toContainText(/¿importar y conciliar/i);

    const botonConfirmar = modalConfirmacion.getByRole('button', { name: /confirmar/i });
    await expect(botonConfirmar).toBeEnabled();
    await botonConfirmar.click();

    // Confirmación del procesamiento del lote
    const avisoResultado = page.locator('main.contenido > p[role="status"], main.contenido > p[role="alert"]');
    await expect(avisoResultado).toBeVisible({ timeout: 25000 });
    await expect(avisoResultado).toContainText(/importaron|conciliad|lote|folio/i);

    await cerrarSesion(page);
  });
});
