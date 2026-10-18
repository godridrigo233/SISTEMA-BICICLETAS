import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Check, KeyRound, Lock, ShieldAlert, X } from 'lucide-react';
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

  // Verificaciones individuales de política para feedback visual (Nielsen H1)
  const tieneLongitud = nueva.length >= 10;
  const tieneLetra = /[a-zA-Z]/.test(nueva);
  const tieneNumero = /\d/.test(nueva);
  const distintaTemporal = nueva !== passwordTemporal.current;

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
      <div style={{ maxWidth: 480, width: '100%' }}>
        <form className="tarjeta" onSubmit={enviar} noValidate>
          <div className="tarjeta-encabezado" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div className="logo-icono-contenedor" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <KeyRound size={24} aria-hidden="true" />
            </div>
            <div>
              <h1>Cree su contraseña</h1>
              <p>Ingresó con una contraseña temporal. Para continuar, defina una contraseña propia.</p>
            </div>
          </div>
          <div className="tarjeta-cuerpo">
            <div className="campo">
              <label htmlFor="nueva">Nueva contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="nueva"
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  aria-invalid={nueva.length > 0 && !valida}
                  aria-describedby="regla"
                  style={{ paddingLeft: 38 }}
                />
                <Lock
                  size={18}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: 12, top: 13, color: 'var(--gris-400)', pointerEvents: 'none' }}
                />
              </div>
              <p id="regla" className={nueva.length > 0 && !valida ? 'error-campo' : 'ayuda'}>
                Mínimo 10 caracteres, con letras y números; distinta de la temporal.
              </p>

              {/* Indicadores visuales de política (Nielsen H1 y H5) */}
              {nueva.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8, fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: tieneLongitud ? 'var(--verde-ucsm)' : 'var(--gris-500)' }}>
                    {tieneLongitud ? <Check size={14} /> : <X size={14} />} Mín. 10 caracteres
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: tieneLetra ? 'var(--verde-ucsm)' : 'var(--gris-500)' }}>
                    {tieneLetra ? <Check size={14} /> : <X size={14} />} Con letras
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: tieneNumero ? 'var(--verde-ucsm)' : 'var(--gris-500)' }}>
                    {tieneNumero ? <Check size={14} /> : <X size={14} />} Con números
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: distintaTemporal ? 'var(--verde-ucsm)' : 'var(--gris-500)' }}>
                    {distintaTemporal ? <Check size={14} /> : <X size={14} />} Distinta a temporal
                  </div>
                </div>
              )}
            </div>

            <div className="campo">
              <label htmlFor="confirmacion">Confirmar contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirmacion"
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  aria-invalid={confirmacion.length > 0 && !coinciden}
                  style={{ paddingLeft: 38 }}
                />
                <Lock
                  size={18}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: 12, top: 13, color: 'var(--gris-400)', pointerEvents: 'none' }}
                />
              </div>
              {confirmacion.length > 0 && !coinciden && <p className="error-campo">Las contraseñas no coinciden.</p>}
            </div>

            {error && <p className="alerta" role="alert">{error}</p>}

            <button type="submit" className="boton boton-primario" disabled={!puedeEnviar} style={{ marginTop: 8 }}>
              {enviando ? 'Guardando…' : 'Guardar y continuar'}
            </button>
            <button type="button" className="boton" onClick={cerrarSesion}>
              Cancelar y salir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
