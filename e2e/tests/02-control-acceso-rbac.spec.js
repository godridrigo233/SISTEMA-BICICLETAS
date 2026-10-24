import { test, expect } from '@playwright/test';
import { config, omitirSiFaltanCredenciales } from '../helpers/config.js';
import { iniciarSesion, cerrarSesion } from '../helpers/auth.js';

test.describe('02 · Control de Acceso Basado en Roles (RBAC)', () => {
  test('Estudiante que intenta acceder a monitoreo o garita es redirigido con aviso (403)', async ({ page }) => {
    if (!omitirSiFaltanCredenciales(test, 'estudiante')) return;

    await iniciarSesion(page, config.usuarios.estudiante);

    // Intento de acceso a pantalla de gestión administrativa
    await page.goto('/gestion/monitoreo');
    await expect(page).toHaveURL(/.*\/estudiante\/historial/);

    const avisoMonitoreo = page.locator('p.aviso[role="status"]');
    await expect(avisoMonitoreo).toBeVisible();
    await expect(avisoMonitoreo).toContainText('No tiene permiso para acceder a esa pantalla (403).');

    // Intento de acceso directo a la consola de contingencias
    await page.goto('/supervisor/contingencias');
    await expect(page).toHaveURL(/.*\/estudiante\/historial/);

    const avisoContingencias = page.locator('p.aviso[role="status"]');
    await expect(avisoContingencias).toBeVisible();
    await expect(avisoContingencias).toContainText('No tiene permiso para acceder a esa pantalla (403).');

    await cerrarSesion(page);
  });

  test('Garitero que intenta acceder a contingencias es redirigido a garita con aviso (403)', async ({ page }) => {
    if (!omitirSiFaltanCredenciales(test, 'garitero')) return;

    await iniciarSesion(page, config.usuarios.garitero);

    // El garitero no tiene acceso a la consola de regularización
    await page.goto('/supervisor/contingencias');
    await expect(page).toHaveURL(/.*\/garita\/control-acceso/);

    const aviso = page.locator('p.aviso[role="status"]');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('No tiene permiso para acceder a esa pantalla (403).');

    await cerrarSesion(page);
  });
});
