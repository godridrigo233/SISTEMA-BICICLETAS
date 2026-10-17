import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSesion } from '../features/auth/SesionContext';
import { RUTA_INICIO_POR_ROL } from './rutasPorRol';

/**
 * Ruta protegida por rol (RBAC). Es una barrera de navegación: la protección real la aplica la API,
 * que responde 403 aunque el usuario escriba la dirección de una pantalla ajena.
 */
export default function ProtectedRoute({ rolesPermitidos }) {
  const { sesion } = useSesion();
  const ubicacion = useLocation();

  if (!sesion) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }
  if (sesion.debeCambiarPassword) {
    return <Navigate to="/cambiar-password" replace />;      // primer ingreso con contraseña temporal
  }
  if (!rolesPermitidos.includes(sesion.idRol)) {
    return (
      <Navigate
        to={RUTA_INICIO_POR_ROL[sesion.idRol]}
        replace
        state={{ aviso: 'No tiene permiso para acceder a esa pantalla (403).' }}
      />
    );
  }
  return <Outlet />;
}
