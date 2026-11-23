import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AyudaPage from './AyudaPage';
import { useSesion } from '../auth/SesionContext';

vi.mock('../auth/SesionContext', () => ({ useSesion: vi.fn() }));

function montar(idRol, entrada = { pathname: '/ayuda', state: { desde: 'Panel Central de Garita' } }) {
  vi.mocked(useSesion).mockReturnValue({ sesion: { idRol } });
  render(<MemoryRouter initialEntries={[entrada]}><AyudaPage /></MemoryRouter>);
}
const tareas = () => within(screen.getByRole('region', { name: 'Cómo realizar sus tareas' }))
  .getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('Ayuda y Soporte', () => {
  it('el Garitero ve solo las tareas de la garita', () => {
    montar(2);
    expect(tareas()).toEqual([
      'Registrar el ingreso de una bicicleta',
      'Autorizar el retiro con verificación facial',
      'Si el sistema rechaza al dueño o no hay conexión',
    ]);
  });

  it('el Supervisor ve además el retiro manual, las contingencias y el monitoreo', () => {
    montar(3);
    expect(tareas()).toContain('Autorizar un retiro manual con DNI');
    expect(tareas()).toContain('Regularizar los movimientos anotados sin conexión');
  });

  it('el Estudiante ve sus tareas y no el aviso de contingencia de la garita', () => {
    montar(1);
    expect(tareas()).toEqual(['Registrar su bicicleta y su rostro', 'Registrar otra bicicleta', 'Consultar sus movimientos']);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('el Administrador ve la gestión de cuentas', () => {
    montar(4);
    expect(tareas()).toContain('Crear una cuenta del personal');
  });

  it('Soporte abre un correo con el rol y la pantalla de origen, y recuerda la contingencia al personal', () => {
    montar(2);
    const soporte = screen.getByRole('region', { name: 'Soporte' });
    expect(within(soporte).getByRole('note')).toHaveTextContent('aplique el protocolo de contingencia');
    const href = within(soporte).getByRole('link', { name: 'Escribir a Soporte' }).getAttribute('href');
    expect(href.startsWith('mailto:oficina.seguridad@ucsm.edu.pe')).toBe(true);
    const cuerpo = decodeURIComponent(href.split('&body=')[1]);
    expect(cuerpo).toContain('Rol: Garitero');
    expect(cuerpo).toContain('Pantalla: Panel Central de Garita');
  });

  it('con #soporte desplaza la vista a la sección de soporte', () => {
    const desplazar = vi.fn();
    Element.prototype.scrollIntoView = desplazar;
    montar(3, { pathname: '/ayuda', hash: '#soporte' });
    expect(desplazar).toHaveBeenCalled();
    delete Element.prototype.scrollIntoView;
  });
  it('ofrece volver a la pantalla de inicio del rol (el Garitero no tiene menú lateral)', () => {
    montar(2);
    expect(screen.getByRole('link', { name: 'Volver a mi pantalla de inicio' })).toHaveAttribute('href', '/garita/control-acceso');
  });
});
