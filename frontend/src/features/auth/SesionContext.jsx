import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const CLAVE = 'sesion-bicicletas-ucsm';

export const SesionContext = createContext({ sesion: null });
export const useSesion = () => useContext(SesionContext);

// La sesión se guarda en sessionStorage (se borra al cerrar la pestaña). La contraseña temporal
// solo vive en memoria el tiempo justo para cambiarla y nunca se guarda en el navegador.
export function leerSesion() {
  try {
    const sesion = JSON.parse(sessionStorage.getItem(CLAVE));
    return sesion && new Date(sesion.expiraEnUtc) > new Date() ? sesion : null;
  } catch {
    return null;
  }
}

function guardarSesion(sesion) {
  try {
    if (sesion) sessionStorage.setItem(CLAVE, JSON.stringify(sesion));
    else sessionStorage.removeItem(CLAVE);
  } catch {
    // almacenamiento no disponible: la sesión sigue en memoria
  }
}

export function SesionProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesion);
  const passwordTemporal = useRef(null);

  const abrirSesion = useCallback((respuesta, password) => {
    const nueva = {
      token: respuesta.token,
      expiraEnUtc: respuesta.expiraEnUtc,
      idRol: respuesta.idRol,
      debeCambiarPassword: respuesta.debeCambiarPassword,
    };
    passwordTemporal.current = respuesta.debeCambiarPassword ? password : null;
    guardarSesion(nueva);
    setSesion(nueva);
  }, []);

  const cerrarSesion = useCallback(() => {
    passwordTemporal.current = null;
    guardarSesion(null);
    setSesion(null);
  }, []);

  // El cliente HTTP avisa con este evento cuando la API responde 401 (token vencido).
  useEffect(() => {
    window.addEventListener('sesion-expirada', cerrarSesion);
    return () => window.removeEventListener('sesion-expirada', cerrarSesion);
  }, [cerrarSesion]);

  const valor = useMemo(
    () => ({ sesion, abrirSesion, cerrarSesion, passwordTemporal }),
    [sesion, abrirSesion, cerrarSesion],
  );
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}
