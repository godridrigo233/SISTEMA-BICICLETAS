import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import CambiarPasswordPage from '../features/auth/CambiarPasswordPage';
import LoginPage from '../features/auth/LoginPage';
import PanelGarita from '../features/garita/PanelGarita';
import RegistroEnrolamiento from '../features/enrolamiento/RegistroEnrolamiento';
import HistorialPage from '../features/historial/HistorialPage';
import MonitoreoPage from '../features/monitoreo/MonitoreoPage';
import ConsolaContingencias from '../features/contingencias/ConsolaContingencias';
import GestionUsuarios from '../features/usuarios/GestionUsuarios';
import { SesionProvider } from '../features/auth/SesionContext';
import Plantilla from './Plantilla';
import ProtectedRoute from './ProtectedRoute';
import { ROL } from './rutasPorRol';

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
              <Route path="/estudiante/registro" element={<RegistroEnrolamiento />} />
              <Route path="/estudiante/historial" element={<HistorialPage />} />
            </Route>
            <Route element={<ProtectedRoute rolesPermitidos={[ROL.GARITERO, ROL.SUPERVISOR, ROL.ADMINISTRADOR]} />}>
              <Route path="/garita/control-acceso" element={<PanelGarita />} />
            </Route>
            <Route element={<ProtectedRoute rolesPermitidos={[ROL.SUPERVISOR, ROL.ADMINISTRADOR]} />}>
              <Route path="/supervisor/contingencias" element={<ConsolaContingencias />} />
              <Route path="/gestion/monitoreo" element={<MonitoreoPage />} />
            </Route>
            <Route element={<ProtectedRoute rolesPermitidos={[ROL.ADMINISTRADOR]} />}>
              <Route path="/admin/usuarios" element={<GestionUsuarios />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </SesionProvider>
  );
}
