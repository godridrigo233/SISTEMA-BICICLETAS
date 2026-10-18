import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bike,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Shield,
  User,
  Users,
  X,
} from 'lucide-react';
import { NOMBRE_SISTEMA } from './constantes';
import { useSesion } from '../features/auth/SesionContext';
import { MENU_POR_ROL, NOMBRE_ROL, ROL } from './rutasPorRol';

/** Mapeo de íconos para las opciones del menú institucional. */
function obtenerIconoMenu(ruta) {
  const props = { size: 18, className: 'menu-icono', 'aria-hidden': 'true' };
  switch (ruta) {
    case '/gestion/monitoreo':
      return <LayoutDashboard {...props} />;
    case '/admin/usuarios':
      return <Users {...props} />;
    case '/garita/control-acceso':
      return <Shield {...props} />;
    case '/supervisor/contingencias':
      return <ClipboardList {...props} />;
    case '/estudiante/historial':
      return <History {...props} />;
    case '/estudiante/registro':
      return <QrCode {...props} />;
    default:
      return <Bike {...props} />;
  }
}

/** Título descriptivo para la barra superior según la ruta activa. */
const TITULOS_RUTA = {
  '/garita/control-acceso': 'Panel Central de Garita',
  '/supervisor/contingencias': 'Consola de Regularización (Contingencias)',
  '/gestion/monitoreo': 'Monitoreo y Reportes',
  '/admin/usuarios': 'Gestión de Usuarios y Roles',
  '/estudiante/historial': 'Mi Historial de Movimientos',
  '/estudiante/registro': 'Registro y Enrolamiento',
};

const INICIALES_ROL = {
  [ROL.ESTUDIANTE]: 'ES',
  [ROL.GARITERO]: 'GT',
  [ROL.SUPERVISOR]: 'SP',
  [ROL.ADMINISTRADOR]: 'AD',
};

/**
 * Plantilla institucional UCSM: Layout con barra lateral verde institucional (#004d2e),
 * barra superior blanca con menú desplegable de usuario, y soporte responsive.
 * Cumple con Heurísticas de Nielsen (H1, H4, H7) e ISO/IEC 25010 (Usabilidad y Accesibilidad).
 */
export default function Plantilla() {
  const { sesion, cerrarSesion } = useSesion();
  const { pathname, state } = useLocation();
  const [aviso, setAviso] = useState('');
  const [colapsada, setColapsada] = useState(false);
  const [movilAbierta, setMovilAbierta] = useState(false);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const refMenuUsuario = useRef(null);

  useEffect(() => {
    const mostrar = (e) => setAviso(e.detail);
    window.addEventListener('aviso-global', mostrar);
    return () => window.removeEventListener('aviso-global', mostrar);
  }, []);

  // Cerrar menú de usuario con Escape o al hacer clic fuera
  useEffect(() => {
    function manejarClickFuera(e) {
      if (refMenuUsuario.current && !refMenuUsuario.current.contains(e.target)) {
        setMenuUsuarioAbierto(false);
      }
    }
    function manejarTecla(e) {
      if (e.key === 'Escape') {
        setMenuUsuarioAbierto(false);
        setMovilAbierta(false);
      }
    }
    document.addEventListener('mousedown', manejarClickFuera);
    document.addEventListener('keydown', manejarTecla);
    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
      document.removeEventListener('keydown', manejarTecla);
    };
  }, []);

  // Cerrar drawer móvil al cambiar de ruta
  useEffect(() => {
    setMovilAbierta(false);
  }, [pathname]);

  const mensaje = aviso || state?.aviso;
  const esGaritero = sesion?.idRol === ROL.GARITERO;
  const itemsMenu = MENU_POR_ROL[sesion?.idRol] ?? [];
  const nombreRol = NOMBRE_ROL[sesion?.idRol] ?? 'Usuario';
  const iniciales = INICIALES_ROL[sesion?.idRol] ?? 'U';
  const tituloPantalla = TITULOS_RUTA[pathname] || NOMBRE_SISTEMA;

  // Garitero: operación a pantalla completa sin barra lateral (CU-03, CU-04)
  if (esGaritero) {
    return (
      <div className="app-layout modo-garitero">
        <header className="barra barra-garita">
          <div className="logo-institucional">
            <div className="logo-icono-contenedor">
              <Bike size={22} aria-hidden="true" />
            </div>
            <div className="logo-titulos">
              <span className="logo-marca">UCSM · Control de Bicicletas</span>
              <span className="logo-submarca">{NOMBRE_SISTEMA}</span>
            </div>
          </div>
          <div className="barra-derecha">
            <span className="etiqueta badge-dentro" style={{ border: 'none', background: 'rgba(255,255,255,0.18)', color: '#ffffff' }}>
              ● Garita Operativa
            </span>
            <div className="usuario-dropdown-contenedor" ref={refMenuUsuario}>
              <button
                type="button"
                className="usuario-trigger"
                onClick={() => setMenuUsuarioAbierto((prev) => !prev)}
                aria-expanded={menuUsuarioAbierto}
                aria-haspopup="true"
                style={{ borderColor: 'rgba(255,255,255,0.25)', color: '#ffffff' }}
              >
                <div className="usuario-avatar" style={{ background: '#ffffff', color: 'var(--verde-oscuro)' }}>
                  {iniciales}
                </div>
                <div className="usuario-info">
                  <span className="usuario-rol" style={{ color: '#ffffff' }}>{nombreRol}</span>
                </div>
                <ChevronDown size={16} aria-hidden="true" style={{ color: 'rgba(255,255,255,0.8)' }} />
              </button>
              {menuUsuarioAbierto && (
                <div className="usuario-menu-popover" role="menu">
                  <div className="usuario-menu-cabecera">
                    <p>Perfil en sesión</p>
                    <strong>{nombreRol}</strong>
                  </div>
                  <button
                    type="button"
                    className="boton"
                    onClick={() => {
                      setMenuUsuarioAbierto(false);
                      cerrarSesion();
                    }}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="boton"
              onClick={cerrarSesion}
              style={{ borderColor: 'rgba(255,255,255,0.5)', color: '#ffffff', background: 'transparent' }}
            >
              Cerrar sesión
            </button>
          </div>
        </header>
        {mensaje && <p className="aviso" role="status" style={{ margin: '16px 24px 0' }}>{mensaje}</p>}
        <Outlet />
      </div>
    );
  }

  // Estudiantes, Supervisores y Administradores: Layout con barra lateral + barra superior
  return (
    <div className="app-layout">
      {/* Backdrop para cerrar menú en móviles */}
      {movilAbierta && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMovilAbierta(false)}
          aria-hidden="true"
        />
      )}

      {/* Barra Lateral Izquierda (Verde oscuro #004d2e) */}
      <aside className={`barra-lateral ${colapsada ? 'colapsada' : ''} ${movilAbierta ? 'abierta-movil' : ''}`}>
        <div className="barra-lateral-cabecera">
          <div className="logo-institucional">
            <div className="logo-icono-contenedor">
              <Bike size={24} aria-hidden="true" />
            </div>
            <div className="logo-titulos">
              <span className="logo-marca">UCSM</span>
              <span className="logo-submarca">Control de Bicicletas</span>
            </div>
          </div>
        </div>

        <div className="barra-lateral-navegacion">
          <nav aria-label="Menú principal" className="menu">
            {itemsMenu.map(([ruta, texto]) => (
              <NavLink
                key={ruta}
                to={ruta}
                className={({ isActive }) => `menu-enlace ${isActive ? 'active' : ''}`}
                title={texto}
              >
                {obtenerIconoMenu(ruta)}
                <span className="menu-texto">{texto}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div>Universidad Católica de Santa María</div>
          <div style={{ opacity: 0.7, marginTop: 2 }}>Arequipa · Perú</div>
        </div>
      </aside>

      {/* Área de Aplicación Principal */}
      <div className="app-principal">
        <header className="barra-superior barra">
          <div className="barra-izquierda">
            {/* Botón hamburguesa para móvil */}
            <button
              type="button"
              className="boton-icono d-movil"
              onClick={() => setMovilAbierta((prev) => !prev)}
              aria-label={movilAbierta ? 'Cerrar navegación móvil' : 'Abrir navegación móvil'}
            >
              {movilAbierta ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>

            {/* Botón colapsar en escritorio */}
            <button
              type="button"
              className="boton-icono d-escritorio"
              onClick={() => setColapsada((prev) => !prev)}
              aria-label={colapsada ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
              title={colapsada ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            >
              {colapsada ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
            </button>

            <h2 className="barra-titulo-pantalla">{tituloPantalla}</h2>
          </div>

          <div className="barra-derecha">
            {/* Menú de Usuario Desplegable */}
            <div className="usuario-dropdown-contenedor" ref={refMenuUsuario}>
              <button
                type="button"
                className="usuario-trigger"
                onClick={() => setMenuUsuarioAbierto((prev) => !prev)}
                aria-expanded={menuUsuarioAbierto}
                aria-haspopup="true"
                aria-label={`Menú de usuario: ${nombreRol}`}
              >
                <div className="usuario-avatar">
                  {iniciales}
                </div>
                <div className="usuario-info">
                  <span className="usuario-rol">{nombreRol}</span>
                </div>
                <ChevronDown size={16} aria-hidden="true" style={{ color: 'var(--gris-500)' }} />
              </button>

              {menuUsuarioAbierto && (
                <div className="usuario-menu-popover" role="menu">
                  <div className="usuario-menu-cabecera">
                    <p>Sesión activa como</p>
                    <strong>{nombreRol}</strong>
                    {sesion?.correo && <span style={{ fontSize: '0.8rem', color: 'var(--gris-500)' }}>{sesion.correo}</span>}
                  </div>
                  <button
                    type="button"
                    className="boton"
                    style={{ width: '100%', borderColor: 'var(--gris-200)', color: 'var(--rojo-error)' }}
                    onClick={() => {
                      setMenuUsuarioAbierto(false);
                      cerrarSesion();
                    }}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>

            {/* Botón de acceso directo para Cerrar sesión */}
            <button
              type="button"
              className="boton"
              onClick={cerrarSesion}
              title="Finalizar sesión en el sistema"
            >
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </header>

        {mensaje && (
          <div style={{ padding: '16px 24px 0' }}>
            <p className="aviso" role="status">{mensaje}</p>
          </div>
        )}

        <Outlet />
      </div>
    </div>
  );
}
