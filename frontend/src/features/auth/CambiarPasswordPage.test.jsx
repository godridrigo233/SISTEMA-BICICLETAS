import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CambiarPasswordPage from './CambiarPasswordPage';
import LoginPage from './LoginPage';
import { SesionProvider } from './SesionContext';
import { cambiarPassword, iniciarSesion } from '../../services/authService';

vi.mock('../../services/authService', () => ({ iniciarSesion: vi.fn(), cambiarPassword: vi.fn() }));

const expira = () => new Date(Date.now() + 1800000).toISOString();

function montar(ruta = '/login') {
  return render(
    <SesionProvider>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
          <Route path="/garita/control-acceso" element={<p>Panel de Garita</p>} />
        </Routes>
      </MemoryRouter>
    </SesionProvider>,
  );
}

describe('W1 · Cree su contraseña', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(iniciarSesion).mockResolvedValue({ token: 't1', expiraEnUtc: expira(), idRol: 2, debeCambiarPassword: true });
    vi.mocked(cambiarPassword).mockResolvedValue({ token: 't2', expiraEnUtc: expira(), idRol: 2, debeCambiarPassword: false });
  });

  it('sin haber iniciado sesión devuelve al Login', () => {
    montar('/cambiar-password');
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('exige política y confirmación, envía la temporal y lleva a la pantalla del rol', async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.type(screen.getByLabelText('Correo institucional'), 'vigilante01@ucsm.edu.pe');
    await usuario.type(screen.getByLabelText('Contraseña'), 'Temporal2026');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    const guardar = await screen.findByRole('button', { name: 'Guardar y continuar' });
    await usuario.type(screen.getByLabelText('Nueva contraseña'), 'MiBicicleta2026');
    await usuario.type(screen.getByLabelText('Confirmar contraseña'), 'MiBicicleta2027');
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(guardar).toBeDisabled();

    await usuario.clear(screen.getByLabelText('Confirmar contraseña'));
    await usuario.type(screen.getByLabelText('Confirmar contraseña'), 'MiBicicleta2026');
    await usuario.click(guardar);

    expect(await screen.findByText('Panel de Garita')).toBeInTheDocument();
    expect(cambiarPassword).toHaveBeenCalledWith('t1', 'Temporal2026', 'MiBicicleta2026');
    expect(sessionStorage.getItem('sesion-bicicletas-ucsm')).not.toContain('Temporal2026');
  });
});
