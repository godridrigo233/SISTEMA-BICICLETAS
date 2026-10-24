import { test, expect } from '@playwright/test';
import { config, omitirSiFaltanCredenciales } from '../helpers/config.js';
import { iniciarSesion, cerrarSesion } from '../helpers/auth.js';

test.describe('01 · Autenticación y Redirección por Rol', () => {
  test('Estudiante inicia sesión y es redirigido a su historial personal', async ({ page }) => {
    if (!omitirSiFaltanCredenciales(test, 'estudiante')) return;

    await iniciarSesion(page, config.usuarios.estudiante);
    await expect(page).toHaveURL(/.*\/estudiante\/historial/);
    await expect(page.getByRole('heading', { name: /mi historial de movimientos/i })).toBeVisible();

    await cerrarSesion(page);
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('Garitero inicia sesión y es redirigido al panel central de garita', async ({ page }) => {
    if (!omitirSiFaltanCredenciales(test, 'garitero')) return;

    await iniciarSesion(page, config.usuarios.garitero);
    await expect(page).toHaveURL(/.*\/garita\/control-acceso/);
    await expect(page.getByRole('heading', { name: /panel central de garita/i })).toBeVisible();

    await cerrarSesion(page);
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('Supervisor inicia sesión y es redirigido al panel central de garita con menú operativo', async ({ page }) => {
    if (!omitirSiFaltanCredenciales(test, 'supervisor')) return;

    await iniciarSesion(page, config.usuarios.supervisor);
    await expect(page).toHaveURL(/.*\/garita\/control-acceso/);
    await expect(page.getByRole('heading', { name: /panel central de garita/i })).toBeVisible();

    // El supervisor cuenta con navegación hacia contingencias y monitoreo
    const navContingencias = page.locator('nav.menu a[href="/supervisor/contingencias"]');
    await expect(navContingencias).toBeVisible();

    await cerrarSesion(page);
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('Administrador inicia sesión y es redirigido a monitoreo y reportes', async ({ page }) => {
    if (!omitirSiFaltanCredenciales(test, 'administrador')) return;

    await iniciarSesion(page, config.usuarios.administrador);
    await expect(page).toHaveURL(/.*\/gestion\/monitoreo/);
    await expect(page.getByRole('heading', { name: /monitoreo y reportes/i })).toBeVisible();

    // El administrador cuenta con acceso al módulo de usuarios
    const navUsuarios = page.locator('nav.menu a[href="/admin/usuarios"]');
    await expect(navUsuarios).toBeVisible();

    await cerrarSesion(page);
    await expect(page).toHaveURL(/.*\/login/);
  });
});
