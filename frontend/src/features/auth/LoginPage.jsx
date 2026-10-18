import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Bike, CheckCircle2, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { NOMBRE_SISTEMA } from '../../app/constantes';
import { RUTA_INICIO_POR_ROL } from '../../app/rutasPorRol';
import { mensajeDeError } from '../../services/apiClient';
import { iniciarSesion } from '../../services/authService';
import { useSesion } from './SesionContext';

// Personal: @ucsm.edu.pe · Estudiantes: @estudiante.ucsm.edu.pe
const DOMINIO = /^[^\s@]+@(estudiante\.)?ucsm\.edu\.pe$/i;

/** W1 · Login unificado para los cuatro roles (RF-01). Diseño dividido institucional. */
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
      <div className="login-dividido">
        {/* Panel Izquierdo: Identidad Institucional UCSM */}
        <aside className="login-panel-institucional" aria-label="Información institucional UCSM">
          <div>
            <div className="login-marca">
              <div className="logo-icono-contenedor" style={{ background: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                <Bike size={28} aria-hidden="true" />
              </div>
              <span>UCSM</span>
            </div>
            <p className="login-lema">
              Control de Accesos Biométrico para Bicicletas
            </p>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', color: '#e8f3ee' }}>
                <CheckCircle2 size={18} aria-hidden="true" style={{ color: '#bbf7d0', flexShrink: 0 }} />
                <span>Verificación facial en tiempo real</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', color: '#e8f3ee' }}>
                <CheckCircle2 size={18} aria-hidden="true" style={{ color: '#bbf7d0', flexShrink: 0 }} />
                <span>Identificación instantánea por código QR</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', color: '#e8f3ee' }}>
                <CheckCircle2 size={18} aria-hidden="true" style={{ color: '#bbf7d0', flexShrink: 0 }} />
                <span>Gestión segura de estacionamiento universitario</span>
              </div>
            </div>
          </div>

          <div className="login-seguridad">
            <ShieldCheck size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>Privacidad protegida. No se almacenan fotografías (Ley N.º 29733).</span>
          </div>
        </aside>

        {/* Panel Derecho: Formulario de Autenticación */}
        <form className="tarjeta" style={{ borderRadius: 0, border: 'none', boxShadow: 'none' }} onSubmit={enviar} noValidate>
          <div className="tarjeta-encabezado">
            <h1>{NOMBRE_SISTEMA}</h1>
            <p>Universidad Católica de Santa María</p>
          </div>
          <div className="tarjeta-cuerpo">
            {state?.aviso && <p className="aviso" role="status">{state.aviso}</p>}

            <div className="campo">
              <label htmlFor="correo">Correo institucional</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="correo"
                  type="email"
                  autoComplete="username"
                  maxLength={100}
                  placeholder="usuario@ucsm.edu.pe"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  aria-invalid={correo.length > 0 && !correoValido}
                  aria-describedby="ayuda-correo"
                  style={{ paddingLeft: 38 }}
                />
                <Mail
                  size={18}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: 12, top: 13, color: 'var(--gris-400)', pointerEvents: 'none' }}
                />
              </div>
              {correo.length > 0 && !correoValido ? (
                <p id="ayuda-correo" className="error-campo">Use su correo @ucsm.edu.pe o @estudiante.ucsm.edu.pe.</p>
              ) : (
                <p id="ayuda-correo" className="ayuda">Personal: @ucsm.edu.pe · Estudiantes: @estudiante.ucsm.edu.pe</p>
              )}
            </div>

            <div className="campo">
              <label htmlFor="password">Contraseña</label>
              <div className="con-boton" style={{ flexWrap: 'nowrap' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    id="password"
                    type={verPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-describedby="nota-password"
                    style={{ paddingLeft: 38 }}
                  />
                  <Lock
                    size={18}
                    aria-hidden="true"
                    style={{ position: 'absolute', left: 12, top: 13, color: 'var(--gris-400)', pointerEvents: 'none' }}
                  />
                </div>
                <button
                  type="button"
                  className="boton"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{ minWidth: 90 }}
                >
                  {verPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  {verPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <p id="nota-password" className="ayuda">Use la contraseña de este sistema, no la de su cuenta Microsoft institucional.</p>
            </div>

            {error && <p className="alerta" role="alert">{error}</p>}

            <button type="submit" className="boton boton-primario" disabled={!puedeEnviar} style={{ marginTop: 8 }}>
              <LogIn size={18} aria-hidden="true" />
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>

            <a className="enlace" href="mailto:soporte.bicicletas@ucsm.edu.pe" style={{ textAlign: 'center', fontSize: '0.875rem', marginTop: 4 }}>
              ¿Problemas para ingresar? Contacte a Soporte
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
