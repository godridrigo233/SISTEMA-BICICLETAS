import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { NOMBRE_SISTEMA } from '../../app/constantes';
import { RUTA_INICIO_POR_ROL } from '../../app/rutasPorRol';
import { mensajeDeError } from '../../services/apiClient';
import { iniciarSesion } from '../../services/authService';
import { useSesion } from './SesionContext';

const DOMINIO = /^[^\s@]+@ucsm\.edu\.pe$/i;

/** W1 · Login unificado para los cuatro roles (RF-01). */
export default function LoginPage() {
  const { sesion, abrirSesion } = useSesion();
  const navegar = useNavigate();
  const { state } = useLocation();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  if (sesion && !sesion.debeCambiarPassword) return <Navigate to={RUTA_INICIO_POR_ROL[sesion.idRol]} replace />;

  const correoValido = DOMINIO.test(correo.trim());
  const puedeEnviar = correoValido && password.length > 0 && !enviando;

  async function enviar(evento) {
    evento.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    setError('');
    try {
      const respuesta = await iniciarSesion(correo.trim(), password);
      abrirSesion(respuesta, password);
      navegar(respuesta.debeCambiarPassword ? '/cambiar-password' : RUTA_INICIO_POR_ROL[respuesta.idRol], { replace: true });
    } catch (e) {
      setError(mensajeDeError(e, 'Credenciales inválidas.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pantalla-centrada">
      <form className="tarjeta" onSubmit={enviar} noValidate>
        <div className="tarjeta-encabezado">
          <h1>{NOMBRE_SISTEMA}</h1>
          <p>Universidad Católica de Santa María</p>
        </div>
        <div className="tarjeta-cuerpo">
          {state?.aviso && <p className="aviso" role="status">{state.aviso}</p>}
          <div className="campo">
            <label htmlFor="correo">Correo institucional</label>
            <input id="correo" type="email" autoComplete="username" maxLength={100} placeholder="usuario@ucsm.edu.pe"
              value={correo} onChange={(e) => setCorreo(e.target.value)}
              aria-invalid={correo.length > 0 && !correoValido} aria-describedby="ayuda-correo" />
            {correo.length > 0 && !correoValido
              ? <p id="ayuda-correo" className="error-campo">Use su correo @ucsm.edu.pe.</p>
              : <p id="ayuda-correo" className="ayuda">Solo dominio @ucsm.edu.pe</p>}
          </div>
          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <div className="con-boton">
              <input id="password" type={verPassword ? 'text' : 'password'} autoComplete="current-password" maxLength={128}
                value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="nota-password" />
              <button type="button" className="boton" onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {verPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p id="nota-password" className="ayuda">Use la contraseña de este sistema, no la de su cuenta Microsoft institucional.</p>
          </div>
          {error && <p className="alerta" role="alert">{error}</p>}
          <button type="submit" className="boton boton-primario" disabled={!puedeEnviar}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
          <a className="enlace" href="mailto:soporte.bicicletas@ucsm.edu.pe">¿Problemas para ingresar? Contacte a Soporte</a>
        </div>
      </form>
    </div>
  );
}
