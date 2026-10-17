import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import CambiarPasswordPage from '../features/auth/CambiarPasswordPage';
import LoginPage from '../features/auth/LoginPage';
import { SesionProvider } from '../features/auth/SesionContext';
import Plantilla from './Plantilla';
import ProtectedRoute from './ProtectedRoute';
import { ROL } from './rutasPorRol';

// Pantallas que se incorporan en los siguientes bloques (W2–W7).
const Pendiente = ({ nombre }) => <main className="contenido"><h1>{nombre}</h1><p>En construcción.</p></main>;

/** Enrutador RBAC (P07, Figura 1): cada rol solo navega a sus pantallas; la API aplica el control real. */
export default function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
          <Route element={<Plantilla />}>
            <Route element={<ProtectedRoute rolesPermitidos={[ROL.ESTUDIANTE]} />}>
              <Route path="/estudiante/registro" element={<Pendiente nombre="W4 · Registro y Enrolamiento" />} />
              <Route path="/estudiante/historial" element={<Pendiente nombre="W5 · Historial" />} />
            </Route>
            <Route element={<ProtectedRoute rolesPermitidos={[ROL.GARITERO, ROL.SUPERVISOR, ROL.ADMINISTRADOR]} />}>
              <Route path="/garita/control-acceso" element={<Pendiente nombre="W2 · Panel Central de Garita" />} />
            </Route>
            <Route element={<ProtectedRoute rolesPermitidos={[ROL.SUPERVISOR, ROL.ADMINISTRADOR]} />}>
              <Route path="/supervisor/contingencias" element={<Pendiente nombre="W3 · Consola de Regularización" />} />
              <Route path="/gestion/monitoreo" element={<Pendiente nombre="W6 · Monitoreo" />} />
            </Route>
            <Route element={<ProtectedRoute rolesPermitidos={[ROL.ADMINISTRADOR]} />}>
              <Route path="/admin/usuarios" element={<Pendiente nombre="W7 · Usuarios y Roles" />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </SesionProvider>
  );
}
