import { test, expect } from '@playwright/test';
import { config, omitirSiFaltanCredenciales } from '../helpers/config.js';
import { iniciarSesion, cerrarSesion } from '../helpers/auth.js';

test.describe('05 · Monitoreo y Reportes - Filtrado y Exportación CSV', () => {
  test('Filtrado de eventos de auditoría y exportación a archivo CSV', async ({ page }) => {
    // Monitoreo está disponible para Supervisor y Administrador
    const rolOperador = config.usuarios.administrador.correo ? 'administrador' : 'supervisor';
    if (!omitirSiFaltanCredenciales(test, rolOperador)) return;

    await iniciarSesion(page, config.usuarios[rolOperador]);
    await page.goto('/gestion/monitoreo');
    await expect(page).toHaveURL(/.*\/gestion\/monitoreo/);
    await expect(page.getByRole('heading', { name: /monitoreo y reportes/i })).toBeVisible();

    // Verificación de KPIs institucionales
    const seccionKpis = page.locator('section.kpis');
    await expect(seccionKpis).toBeVisible();

    // Formulario de filtros
    const formFiltros = page.locator('form.filtros');
    await expect(formFiltros).toBeVisible();

    // Aplicar filtros de búsqueda
    await page.locator('#m-tipo').selectOption('INGRESO');
    await page.locator('#m-resultado').selectOption('EXITOSO');

    const botonFiltrar = page.getByRole('button', { name: /filtrar/i });
    await expect(botonFiltrar).toBeEnabled();
    await botonFiltrar.click();

    // Verificar botón de exportación
    const botonExportar = page.getByRole('button', { name: /exportar csv/i });

    // Si con el filtro aplicado no existen filas para exportar, se limpia para exportar la bitácora general
    if (await botonExportar.isDisabled()) {
      const botonLimpiar = page.getByRole('button', { name: /limpiar/i });
      await botonLimpiar.click();
    }

    // Exportar CSV y validar la descarga generada por la API
    await expect(botonExportar).toBeEnabled({ timeout: 15000 });

    const [descarga] = await Promise.all([
      page.waitForEvent('download', { timeout: 25000 }),
      botonExportar.click(),
    ]);

    const nombreArchivo = descarga.suggestedFilename();
    expect(nombreArchivo).toMatch(/\.csv$/i);

    await cerrarSesion(page);
  });
});
