import { test, expect } from '@playwright/test';
import { config, omitirSiFaltanCredenciales } from '../helpers/config.js';
import { iniciarSesion, cerrarSesion } from '../helpers/auth.js';

test.describe('03 · Panel Central de Garita - Ingreso de Bicicleta', () => {
  test('Consulta de bicicleta por QR digitado y registro de ingreso (FUERA → DENTRO)', async ({ page }) => {
    // Para operar garita se requiere usuario Garitero o Supervisor
    const rolOperador = config.usuarios.garitero.correo ? 'garitero' : 'supervisor';
    if (!omitirSiFaltanCredenciales(test, rolOperador)) return;

    await iniciarSesion(page, config.usuarios[rolOperador]);
    await expect(page).toHaveURL(/.*\/garita\/control-acceso/);

    const inputQr = page.locator('#qr');
    await expect(inputQr).toBeVisible();

    // Digitación del código QR de prueba (CU-03, 2a: escáner 2D o digitación)
    await inputQr.fill(config.datosPrueba.bicicletaQr);
    const botonConsultar = page.getByRole('button', { name: /consultar/i });
    await expect(botonConsultar).toBeEnabled();
    await botonConsultar.click();

    // Verificación de ficha de la bicicleta identificada
    const fichaBicicleta = page.locator('section[aria-label="Bicicleta identificada"]');
    await expect(fichaBicicleta).toBeVisible();

    // Si la bicicleta se encuentra FUERA, se registra el ingreso
    const botonIngreso = page.getByRole('button', { name: /registrar ingreso/i });
    if (await botonIngreso.isVisible()) {
      await botonIngreso.click();

      // Notificación de éxito institucional
      const mensajeExito = page.locator('p.exito[role="status"]');
      await expect(mensajeExito).toBeVisible();
      await expect(mensajeExito).toContainText(/ingreso registrado/i);
      await expect(mensajeExito).toContainText(/la bicicleta figura dentro/i);

      // Verificación en la bitácora de últimos movimientos
      const tablaMovimientos = page.locator('section[aria-label="Últimos movimientos en esta garita"] table.tabla');
      await expect(tablaMovimientos).toBeVisible();
      await expect(tablaMovimientos.locator('tbody tr').first()).toContainText('INGRESO');
      await expect(tablaMovimientos.locator('tbody tr').first()).toContainText('EXITOSO');
    } else {
      // Si ya se encontraba DENTRO, se verifica que la consulta refleje dicho estado correctamente
      await expect(fichaBicicleta).toContainText('DENTRO DEL CAMPUS');
    }

    await cerrarSesion(page);
  });
});
