import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';
import { SesionProvider } from './SesionContext';
import { iniciarSesion } from '../../services/authService';

vi.mock('../../services/authService', () => ({ iniciarSesion: vi.fn() }));

function montar() {
  return render(
    <SesionProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/garita/control-acceso" element={<p>Panel de Garita</p>} />
          <Route path="/cambiar-password" element={<p>Cree su contraseña</p>} />
        </Routes>
      </MemoryRouter>
    </SesionProvider>,
  );
}

describe('W1 · LoginPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(iniciarSesion).mockReset();
  });

  it('muestra el nombre del sistema y la nota para no confundir la contraseña (Nielsen H5)', () => {
    montar();
    expect(screen.getByRole('heading', { name: 'Sistema de Control de Accesos de Bicicletas' })).toBeInTheDocument();
    expect(screen.getByText(/no la de su cuenta Microsoft institucional/)).toBeInTheDocument();
  });

  it('advierte antes de intentar que 5 fallos bloquean la cuenta 15 minutos (Nielsen H5, HU-14)', () => {
    montar();
    const aviso = screen.getByText('Por seguridad, tras 5 intentos fallidos la cuenta se bloquea durante 15 minutos.');
    expect(aviso).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription(/5 intentos fallidos/);
  });

  it('mantiene deshabilitado «Ingresar» hasta tener un correo @ucsm.edu.pe y una contraseña', async () => {
    const usuario = userEvent.setup();
    montar();
    const boton = screen.getByRole('button', { name: 'Ingresar' });
    expect(boton).toBeDisabled();

    await usuario.type(screen.getByLabelText('Correo institucional'), 'alguien@gmail.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'Clave2026xx');
    expect(boton).toBeDisabled();
    expect(screen.getByText('Use su correo @ucsm.edu.pe o @estudiante.ucsm.edu.pe.')).toBeInTheDocument();

    await usuario.clear(screen.getByLabelText('Correo institucional'));
    await usuario.type(screen.getByLabelText('Correo institucional'), 'vigilante01@ucsm.edu.pe');
    expect(boton).toBeEnabled();

    await usuario.clear(screen.getByLabelText('Correo institucional'));
    await usuario.type(screen.getByLabelText('Correo institucional'), 'alumno01@estudiante.ucsm.edu.pe');
    expect(boton).toBeEnabled();
  });

  it('lleva al Garitero a su pantalla inicial tras un login correcto', async () => {
    vi.mocked(iniciarSesion).mockResolvedValue({
      token: 'jwt', expiraEnUtc: new Date(Date.now() + 1800000).toISOString(), idRol: 2, debeCambiarPassword: false,
    });
    const usuario = userEvent.setup();
    montar();
    await usuario.type(screen.getByLabelText('Correo institucional'), 'vigilante01@ucsm.edu.pe');
    await usuario.type(screen.getByLabelText('Contraseña'), 'Clave2026xx');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Panel de Garita')).toBeInTheDocument();
  });

  it('envía al cambio obligatorio si la contraseña es temporal', async () => {
    vi.mocked(iniciarSesion).mockResolvedValue({
      token: 'jwt', expiraEnUtc: new Date(Date.now() + 1800000).toISOString(), idRol: 3, debeCambiarPassword: true,
    });
    const usuario = userEvent.setup();
    montar();
    await usuario.type(screen.getByLabelText('Correo institucional'), 'supervisor@ucsm.edu.pe');
    await usuario.type(screen.getByLabelText('Contraseña'), 'Temporal2026');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Cree su contraseña')).toBeInTheDocument();
  });

  it('muestra el mensaje genérico de la API ante credenciales inválidas', async () => {
    vi.mocked(iniciarSesion).mockRejectedValue({ response: { status: 401, data: { detail: 'Credenciales inválidas.' } } });
    const usuario = userEvent.setup();
    montar();
    await usuario.type(screen.getByLabelText('Correo institucional'), 'vigilante01@ucsm.edu.pe');
    await usuario.type(screen.getByLabelText('Contraseña'), 'Incorrecta1');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas.');
  });
});
