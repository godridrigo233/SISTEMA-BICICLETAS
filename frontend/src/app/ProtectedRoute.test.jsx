import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import { ROL } from './rutasPorRol';
import { SesionContext } from '../features/auth/SesionContext';

function Aviso({ titulo }) {
  const { state } = useLocation();
  return <p>{titulo}{state?.aviso ? ` · ${state.aviso}` : ''}</p>;
}

function montar(sesion, ruta = '/garita/control-acceso') {
  return render(
    <SesionContext.Provider value={{ sesion }}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/login" element={<Aviso titulo="Login" />} />
          <Route path="/cambiar-password" element={<Aviso titulo="Cambiar contraseña" />} />
          <Route path="/estudiante/historial" element={<Aviso titulo="Historial" />} />
          <Route element={<ProtectedRoute rolesPermitidos={[ROL.GARITERO, ROL.SUPERVISOR, ROL.ADMINISTRADOR]} />}>
            <Route path="/garita/control-acceso" element={<Aviso titulo="Panel de Garita" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SesionContext.Provider>,
  );
}

describe('ProtectedRoute (RBAC)', () => {
  it('redirige al Login a un usuario sin sesión', () => {
    montar(null);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('permite al Garitero abrir el Panel de Garita', () => {
    montar({ idRol: ROL.GARITERO, debeCambiarPassword: false });
    expect(screen.getByText('Panel de Garita')).toBeInTheDocument();
  });

  it('devuelve al Estudiante a su inicio con aviso 403', () => {
    montar({ idRol: ROL.ESTUDIANTE, debeCambiarPassword: false });
    expect(screen.getByText(/Historial · No tiene permiso/)).toBeInTheDocument();
  });

  it('obliga a cambiar la contraseña temporal antes de cualquier pantalla', () => {
    montar({ idRol: ROL.SUPERVISOR, debeCambiarPassword: true });
    expect(screen.getByText('Cambiar contraseña')).toBeInTheDocument();
  });
});
