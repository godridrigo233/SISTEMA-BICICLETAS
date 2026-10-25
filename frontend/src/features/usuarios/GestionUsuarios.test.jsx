import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GestionUsuarios from './GestionUsuarios';
import { cambiarEstado, crearUsuario, listarUsuarios, restablecerPassword } from '../../services/usuariosService';

vi.mock('../../services/usuariosService', () => ({ listarUsuarios: vi.fn(), crearUsuario: vi.fn(), restablecerPassword: vi.fn(), cambiarEstado: vi.fn() }));

const cuentas = [
  { idUsuario: 'u1', correo: 'vig@ucsm.edu.pe', idRol: 2, rol: 'Garitero', creadoEnUtc: '2026-10-01T15:00:00Z', activo: true },
  { idUsuario: 'u2', correo: 'alumno@estudiante.ucsm.edu.pe', idRol: 1, rol: 'Estudiante', creadoEnUtc: null, activo: true },
  { idUsuario: 'u3', correo: 'ex@ucsm.edu.pe', idRol: 3, rol: 'Supervisor', creadoEnUtc: null, activo: false },
];

describe('W7 · Gestión de Usuarios y Roles', () => {
  beforeEach(() => vi.mocked(listarUsuarios).mockResolvedValue({ total: 3, numeroPagina: 1, tamanoPagina: 20, elementos: cuentas }));
  afterEach(() => vi.clearAllMocks());

  it('crea la cuenta solo con correo @ucsm.edu.pe y rol, y muestra la temporal una vez', async () => {
    vi.mocked(crearUsuario).mockResolvedValue({ idUsuario: 'n', correo: 'nuevo@ucsm.edu.pe', rol: 'Supervisor', passwordTemporal: 'Ab3dEf7hJk9m' });
    const usuario = userEvent.setup();
    render(<GestionUsuarios />);
    const crear = screen.getByRole('button', { name: 'Crear cuenta' });
    await usuario.type(screen.getByLabelText(/Correo institucional/), 'nuevo@estudiante.ucsm.edu.pe');
    await usuario.selectOptions(screen.getByLabelText('Rol *'), '3');
    expect(crear).toBeDisabled();
    await usuario.clear(screen.getByLabelText(/Correo institucional/));
    await usuario.type(screen.getByLabelText(/Correo institucional/), 'nuevo@ucsm.edu.pe');
    await usuario.click(crear);

    expect(crearUsuario).toHaveBeenCalledWith('nuevo@ucsm.edu.pe', 3);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByDisplayValue('Ab3dEf7hJk9m')).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByDisplayValue('Ab3dEf7hJk9m')).not.toBeInTheDocument();
  });

  it('inactivar a un estudiante advierte el borrado del descriptor y pide confirmación', async () => {
    vi.mocked(cambiarEstado).mockResolvedValue({});
    const usuario = userEvent.setup();
    render(<GestionUsuarios />);
    await usuario.click(await screen.findByLabelText('Cuenta alumno@estudiante.ucsm.edu.pe activa'));
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('Se eliminará su descriptor biométrico');
    expect(cambiarEstado).not.toHaveBeenCalled();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Inactivar' }));
    expect(cambiarEstado).toHaveBeenCalledWith('u2', false);
  });

  it('«Restablecer contraseña» está deshabilitado en cuentas inactivas', async () => {
    vi.mocked(restablecerPassword).mockResolvedValue({ correo: 'vig@ucsm.edu.pe', rol: 'Garitero', passwordTemporal: 'Zz9yXx8wVv7u' });
    const usuario = userEvent.setup();
    render(<GestionUsuarios />);
    const botones = await screen.findAllByRole('button', { name: 'Restablecer contraseña' });
    expect(botones[2]).toBeDisabled();
    await usuario.click(botones[0]);
    expect(restablecerPassword).not.toHaveBeenCalled(); // primero se confirma (Nielsen H5)
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('dejará de funcionar de inmediato');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Restablecer' }));
    expect(restablecerPassword).toHaveBeenCalledWith('u1');
    expect(await screen.findByDisplayValue('Zz9yXx8wVv7u')).toBeInTheDocument();
  });
});
