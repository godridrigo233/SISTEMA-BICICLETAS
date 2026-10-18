import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import LoginPage from '../features/auth/LoginPage';
import { SesionProvider } from '../features/auth/SesionContext';
import { iniciarPrecalentamiento } from '../services/precalentador';
import Plantilla from './Plantilla';
import ProtectedRoute from './ProtectedRoute';
import { ROL } from './rutasPorRol';

// Carga diferida (code splitting) de pantallas para optimizar el bundle inicial
const CambiarPasswordPage = lazy(() => import('../features/auth/CambiarPasswordPage'));
const PanelGarita = lazy(() => import('../features/garita/PanelGarita'));
const RegistroEnrolamiento = lazy(() => import('../features/enrolamiento/RegistroEnrolamiento'));
const HistorialPage = lazy(() => import('../features/historial/HistorialPage'));
const MonitoreoPage = lazy(() => import('../features/monitoreo/MonitoreoPage'));
const ConsolaContingencias = lazy(() => import('../features/contingencias/ConsolaContingencias'));
const GestionUsuarios = lazy(() => import('../features/usuarios/GestionUsuarios'));

function CargandoPantalla() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 16,
        padding: 32,
      }}
    >
      <Loader2 size={36} className="girando" style={{ color: 'var(--verde-600)' }} aria-hidden="true" />
      <p style={{ color: 'var(--verde-800)', fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
        Cargando módulo institucional…
      </p>
    </div>
  );
}

/** Enrutador RBAC (P07, Figura 1): cada rol solo navega a sus pantallas; la API aplica el control real. */
export default function App() {
  useEffect(() => {
    iniciarPrecalentamiento();
  }, []);

  return (
    <SesionProvider>
      <BrowserRouter>
        <Suspense fallback={<CargandoPantalla />}>
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
        </Suspense>
      </BrowserRouter>
    </SesionProvider>
  );
}
