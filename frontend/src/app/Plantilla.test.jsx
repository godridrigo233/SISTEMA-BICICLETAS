import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Plantilla from './Plantilla';
import { useSesion } from '../features/auth/SesionContext';

vi.mock('../features/auth/SesionContext', () => ({ useSesion: vi.fn() }));

function montar(idRol) {
  vi.mocked(useSesion).mockReturnValue({ sesion: { idRol }, cerrarSesion: vi.fn() });
  render(<MemoryRouter><Plantilla /></MemoryRouter>);
}
const enlaces = () => screen.queryAllByRole('link').map((a) => a.textContent);

describe('Menú por rol (RBAC en la navegación)', () => {
  it('el Administrador ve Monitoreo, Usuarios, Garita y Contingencias', () => {
    montar(4);
    expect(enlaces()).toEqual(['Monitoreo', 'Usuarios', 'Garita', 'Contingencias']);
  });
  it('el Supervisor no ve Usuarios', () => {
    montar(3);
    expect(enlaces()).toEqual(['Garita', 'Contingencias', 'Monitoreo']);
  });
  it('el Garitero no tiene menú', () => {
    montar(2);
    expect(enlaces()).toEqual([]);
  });
  it('el Estudiante ve Mi historial y Mi registro', () => {
    montar(1);
    expect(enlaces()).toEqual(['Mi historial', 'Mi registro']);
  });
});
