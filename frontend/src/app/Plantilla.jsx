import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { NOMBRE_SISTEMA } from './constantes';
import { useSesion } from '../features/auth/SesionContext';
import { MENU_POR_ROL, NOMBRE_ROL } from './rutasPorRol';

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
        <nav aria-label="Menú principal" className="menu">
          {(MENU_POR_ROL[sesion?.idRol] ?? []).map(([ruta, texto]) => <NavLink key={ruta} to={ruta}>{texto}</NavLink>)}
        </nav>
        <span>{NOMBRE_ROL[sesion?.idRol]}</span>
        <button type="button" className="boton" onClick={cerrarSesion}>Cerrar sesión</button>
      </header>
      {mensaje && <p className="aviso" role="status" style={{ margin: 16 }}>{mensaje}</p>}
      <Outlet />
    </>
  );
}
