import { expect } from '@playwright/test';

/**
 * Inicia sesión en el sistema a través del formulario unificado /login.
 * @param {import('@playwright/test').Page} page
 * @param {{ correo: string, password: string, rutaInicio?: string }} usuario
 */
export async function iniciarSesion(page, usuario) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Si había una sesión previa en la pestaña, cerrarla para un estado limpio
  if (!page.url().includes('/login')) {
    await cerrarSesion(page);
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
  }

  const inputCorreo = page.locator('#correo');
  const inputPassword = page.locator('#password');
  const botonIngresar = page.getByRole('button', { name: /ingresar/i });

  await inputCorreo.fill(usuario.correo);
  await inputPassword.fill(usuario.password);

  await expect(botonIngresar).toBeEnabled();
  await botonIngresar.click();

  if (usuario.rutaInicio) {
    await page.waitForURL(`**${usuario.rutaInicio}*`, { timeout: 25000 });
  }
}

/**
 * Cierra la sesión activa y espera la redirección a /login.
 * @param {import('@playwright/test').Page} page
 */
export async function cerrarSesion(page) {
  if (page.url().includes('/login')) return;

  // Botón directo en la barra superior institucional
  const botonDirecto = page.locator('header.barra button:has-text("Cerrar sesión")').first();
  if (await botonDirecto.isVisible()) {
    await botonDirecto.click();
  } else {
    // Si la pantalla usa el menú popover de usuario
    const trigger = page.locator('.usuario-trigger').first();
    if (await trigger.isVisible()) {
      await trigger.click();
      const botonPopover = page.locator('.usuario-menu-popover button:has-text("Cerrar sesión")').first();
      if (await botonPopover.isVisible()) {
        await botonPopover.click();
      }
    }
  }

  await page.waitForURL('**/login', { timeout: 15000 });
}
