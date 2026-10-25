import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAxe } from 'vitest-axe';
import GestionUsuarios from './GestionUsuarios';
import { listarUsuarios } from '../../services/usuariosService';

vi.mock('../../services/usuariosService', () => ({
  listarUsuarios: vi.fn(),
  crearUsuario: vi.fn(),
  restablecerPassword: vi.fn(),
  cambiarEstado: vi.fn(),
}));

// Se desactiva únicamente la regla color-contrast porque jsdom no calcula estilos y daría falsos resultados.
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

const cuentasEjemplo = [
  {
    idUsuario: 'u1',
    correo: 'vig@ucsm.edu.pe',
    idRol: 2,
    rol: 'Garitero',
    creadoEnUtc: '2026-10-01T15:00:00Z',
    activo: true,
  },
  {
    idUsuario: 'u2',
    correo: 'alumno@estudiante.ucsm.edu.pe',
    idRol: 1,
    rol: 'Estudiante',
    creadoEnUtc: null,
    activo: true,
  },
  {
    idUsuario: 'u3',
    correo: 'ex@ucsm.edu.pe',
    idRol: 3,
    rol: 'Supervisor',
    creadoEnUtc: null,
    activo: false,
  },
];

describe('W7 · Gestión de Usuarios y Roles (Accesibilidad)', () => {
  beforeEach(() => {
    vi.mocked(listarUsuarios).mockResolvedValue({
      total: 3,
      numeroPagina: 1,
      tamanoPagina: 20,
      elementos: cuentasEjemplo,
    });
  });

  it('no presenta violaciones de accesibilidad con axe con datos cargados', async () => {
    const { container } = render(<GestionUsuarios />);
    await screen.findByText('Gestión de Usuarios y Roles');
    await screen.findByText('vig@ucsm.edu.pe');
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
