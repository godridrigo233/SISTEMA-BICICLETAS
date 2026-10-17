import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NOMBRE_SISTEMA } from './constantes';
import { useSesion } from '../features/auth/SesionContext';
import { NOMBRE_ROL } from './rutasPorRol';

/** Barra superior común a las pantallas autenticadas y avisos globales (Nielsen H1). */
export default function Plantilla() {
  const { sesion, cerrarSesion } = useSesion();
  const { state } = useLocation();
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const mostrar = (e) => setAviso(e.detail);
    window.addEventListener('aviso-global', mostrar);
    return () => window.removeEventListener('aviso-global', mostrar);
  }, []);

  const mensaje = aviso || state?.aviso;
  return (
    <>
      <header className="barra">
        <strong>{NOMBRE_SISTEMA}</strong>
        <span>{NOMBRE_ROL[sesion?.idRol]}</span>
        <button type="button" className="boton" onClick={cerrarSesion}>Cerrar sesión</button>
      </header>
      {mensaje && <p className="aviso" role="status" style={{ margin: 16 }}>{mensaje}</p>}
      <Outlet />
    </>
  );
}
