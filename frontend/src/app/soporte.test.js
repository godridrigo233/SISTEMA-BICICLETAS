import { describe, expect, it } from 'vitest';
import { CORREO_SOPORTE, enlaceSoporte } from './soporte';

describe('Canal de soporte', () => {
  it('dirige a la Dirección de Seguridad Institucional', () => {
    expect(CORREO_SOPORTE).toBe('oficina.seguridad@ucsm.edu.pe');
  });

  it('arma el reporte con el rol, la pantalla y la hora de Lima', () => {
    const enlace = enlaceSoporte({ rol: 'Garitero', pantalla: 'Panel Central de Garita', fecha: new Date('2026-12-07T12:30:00Z') });
    expect(enlace.startsWith('mailto:oficina.seguridad@ucsm.edu.pe?subject=')).toBe(true);
    const cuerpo = decodeURIComponent(enlace.split('&body=')[1]);
    expect(decodeURIComponent(enlace.split('subject=')[1].split('&')[0])).toBe('[Control de Bicicletas] Incidencia - Garitero');
    expect(cuerpo).toContain('Rol: Garitero');
    expect(cuerpo).toContain('Pantalla: Panel Central de Garita');
    expect(cuerpo).toMatch(/Fecha y hora: 7\/12\/26,? 7:30/);
  });

  it('sin sesión indica que el reporte viene del inicio de sesión', () => {
    const cuerpo = decodeURIComponent(enlaceSoporte({ pantalla: 'Inicio de sesión' }).split('&body=')[1]);
    expect(cuerpo).toContain('Rol: Sin sesión');
    expect(cuerpo).toContain('Pantalla: Inicio de sesión');
  });
});
