import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { RUTA_INICIO_POR_ROL } from '../../app/rutasPorRol';
import { mensajeDeError } from '../../services/apiClient';
import { cambiarPassword } from '../../services/authService';
import { cumplePolitica } from './politicaContrasena';
import { useSesion } from './SesionContext';


/** W1 · Estado alterno «Cree su contraseña» (primer ingreso con contraseña temporal, OWASP A07). */
export default function CambiarPasswordPage() {
  const { sesion, abrirSesion, cerrarSesion, passwordTemporal } = useSesion();
  const navegar = useNavigate();
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // Sin sesión, o si se recargó la página y ya no se tiene la contraseña temporal: volver al Login.
  if (!sesion || !passwordTemporal.current) {
    return <Navigate to="/login" replace state={{ aviso: 'Inicie sesión con su contraseña temporal para crear la suya.' }} />;
  }
  if (!sesion.debeCambiarPassword) return <Navigate to={RUTA_INICIO_POR_ROL[sesion.idRol]} replace />;

  const valida = cumplePolitica(nueva);
  const coinciden = nueva === confirmacion;
  const puedeEnviar = valida && coinciden && !enviando;

  async function enviar(evento) {
    evento.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    setError('');
    try {
      const respuesta = await cambiarPassword(sesion.token, passwordTemporal.current, nueva);
      abrirSesion(respuesta, null);
      navegar(RUTA_INICIO_POR_ROL[respuesta.idRol], { replace: true });
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo cambiar la contraseña.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pantalla-centrada">
      <form className="tarjeta" onSubmit={enviar} noValidate>
        <div className="tarjeta-encabezado">
          <h1>Cree su contraseña</h1>
          <p>Ingresó con una contraseña temporal. Para continuar, defina una contraseña propia.</p>
        </div>
        <div className="tarjeta-cuerpo">
          <div className="campo">
            <label htmlFor="nueva">Nueva contraseña</label>
            <input id="nueva" type="password" autoComplete="new-password" maxLength={128} value={nueva}
              onChange={(e) => setNueva(e.target.value)} aria-invalid={nueva.length > 0 && !valida} aria-describedby="regla" />
            <p id="regla" className={nueva.length > 0 && !valida ? 'error-campo' : 'ayuda'}>
              Mínimo 10 caracteres, con letras y números; distinta de la temporal.
            </p>
          </div>
          <div className="campo">
            <label htmlFor="confirmacion">Confirmar contraseña</label>
            <input id="confirmacion" type="password" autoComplete="new-password" maxLength={128} value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)} aria-invalid={confirmacion.length > 0 && !coinciden} />
            {confirmacion.length > 0 && !coinciden && <p className="error-campo">Las contraseñas no coinciden.</p>}
          </div>
          {error && <p className="alerta" role="alert">{error}</p>}
          <button type="submit" className="boton boton-primario" disabled={!puedeEnviar}>
            {enviando ? 'Guardando…' : 'Guardar y continuar'}
          </button>
          <button type="button" className="boton" onClick={cerrarSesion}>Cancelar y salir</button>
        </div>
      </form>
    </div>
  );
}
