import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  ScanFace,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { abrirCamara, capturarAutomaticamente, extraerDescriptor, prepararBiometria, sinAceleracionGrafica } from '../../biometria/extractorFacial';
import { autorizarRetiro, retiroManual } from '../../services/garitaService';
import { mensajeDeError } from '../../services/apiClient';
import { crearAjusteExposicion, mantenerPantallaEncendida } from '../../biometria/camara';

/**
 * CU-04 en W2: captura del rostro, extracción del descriptor en el navegador y decisión en la API.
 * El video solo se muestra en vivo: ningún fotograma se guarda ni se envía (Ley N.º 29733).
 * La captura es automática: el sistema analiza el video y captura cuando el rostro cumple el control de calidad
 * durante un segundo; mientras tanto, indica al vigilante qué corregir. Si a los 10 s no lo logra, sigue
 * intentando y ofrece además la captura manual.
 */
const CLAVE_LUZ = 'garita.luzPantalla';

export default function VerificacionRetiro({ bicicleta, alTerminar, alCancelar, permiteManual = false }) {
  const video = useRef(null);
  const seccion = useRef(null);
  const botonCapturar = useRef(null);
  const flujo = useRef(null);
  const faceapi = useRef(null);
  const [fase, setFase] = useState('preparando');
  const [mensaje, setMensaje] = useState('');
  const [resultado, setResultado] = useState(null);
  const [derivable, setDerivable] = useState(false);
  const [dni, setDni] = useState('');
  const [manual, setManual] = useState(false);
  const [lento, setLento] = useState(false);
  const [estado, setEstado] = useState(null);
  const [demora, setDemora] = useState('');
  // «Luz de pantalla»: opcional en la garita, para cuando la pantalla mira al estudiante (p. ej., un segundo
  // monitor o una tableta). Se recuerda en este navegador.
  const [luzPantalla, setLuzPantalla] = useState(() => {
    try { return localStorage.getItem(CLAVE_LUZ) === '1'; } catch { return false; }
  });
  // Modo de diagnóstico para el ensayo previo a la Fase B: ?diagnostico muestra las métricas de calidad.
  const [diagnostico] = useState(() => new URLSearchParams(window.location.search).has('diagnostico'));
  const busqueda = useRef(null);
  const ajusteExposicion = useRef(null);

  useEffect(() => {
    let activo = true;
    let liberarPantalla = () => {};
    async function preparar() {
      try {
        faceapi.current = await prepararBiometria();
        if (activo) setLento(sinAceleracionGrafica(faceapi.current));
      } catch {
        if (activo) {
          setFase('sin-camara');
          setMensaje('No se pudo cargar el reconocimiento facial. Recargue la página; si persiste, active la aceleración gráfica del navegador o derive al supervisor.');
        }
        return;
      }
      try {
        flujo.current = await abrirCamara();
        if (!activo) return;
        if (video.current) video.current.srcObject = flujo.current;
        // Iluminación: la cámara aclara la imagen si el rostro está oscuro y la pantalla no se atenúa.
        ajusteExposicion.current = crearAjusteExposicion(flujo.current.getVideoTracks?.()[0]);
        liberarPantalla = await mantenerPantallaEncendida();
        if (!activo) liberarPantalla();
        setFase('buscando');
      } catch {
        if (activo) {
          setFase('sin-camara');
          setMensaje('No se detecta una cámara o no se dio permiso. Conecte o habilite la cámara e intente nuevamente.');
        }
      }
    }
    void preparar();
    return () => {
      activo = false;
      busqueda.current?.abort();
      liberarPantalla();
      flujo.current?.getTracks().forEach((pista) => pista.stop());
    };
  }, []);

  // Captura automática con control de calidad (pose, distancia, centrado e iluminación).
  useEffect(() => {
    if (fase !== 'buscando') return undefined;
    const control = new AbortController();
    busqueda.current = control;
    setMensaje('');
    setEstado(null);
    setDemora('');
    capturarAutomaticamente(video.current, faceapi.current, {
      destinatario: 'vigilante',
      senal: control.signal,
      alCambiar: (e) => {
        setEstado(e);
        ajusteExposicion.current?.(e.metricas?.brillo);
      },
      alDemorar: setDemora,
    })
      .then(({ descriptor, inicioCaptura }) => {
        if (!control.signal.aborted) void verificar(descriptor, inicioCaptura);
      })
      .catch((error) => {
        if (control.signal.aborted || error?.codigo === 'CANCELADO') return;
        setFase('lista');
        setMensaje(
          error?.codigo === 'TIEMPO_AGOTADO'
            ? `No se logró una captura con buena calidad. ${error.message} Luego capture manualmente o reanude la captura automática.`
            : error?.message ?? 'No se pudo analizar el video de la cámara.',
        );
      });
    return () => control.abort();
  }, [fase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nielsen H7: la verificación queda a la vista y «Capturar y verificar» recibe el foco, de modo que
  // el vigilante no necesita desplazarse ni usar el ratón (Enter captura).
  useEffect(() => {
    seccion.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, []);
  useEffect(() => {
    if (fase === 'lista' || (fase === 'buscando' && demora)) botonCapturar.current?.focus();
  }, [fase, demora]);

  // RNF-01: el reloj inicia con el cálculo del descriptor (no con la espera previa); la API suma su decisión.
  async function verificar(descriptor, inicioCaptura) {
    setFase('verificando');
    setMensaje('');
    try {
      const respuesta = await autorizarRetiro(bicicleta.idBicicleta, descriptor, Math.round(performance.now() - inicioCaptura));
      descriptor.fill(0); // se descarta también en el navegador
      setResultado(respuesta);
      if (respuesta.resultado === 'AUTORIZADO') {
        alTerminar({ tipo: 'exito', resultado: 'EXITOSO', texto: `Retiro autorizado: ${bicicleta.titular}. La bicicleta figura FUERA.` });
      } else {
        setFase('denegado');
        setDerivable(true);
      }
    } catch (error) {
      mostrarError(error);
    }
  }

  /** Captura manual: respaldo cuando la captura automática no logra la calidad en el tiempo previsto. */
  async function capturar() {
    busqueda.current?.abort();
    setFase('verificando');
    setMensaje('');
    const inicioCaptura = performance.now();
    try {
      const descriptor = await extraerDescriptor(video.current, faceapi.current);
      await verificar(descriptor, inicioCaptura);
    } catch (error) {
      mostrarError(error);
    }
  }

  function mostrarError(error) {
    setFase('lista');
    if (error?.response?.status === 409) setDerivable(true); // p. ej., titular sin enrolamiento
    // Los mensajes de captura se dirigen al vigilante, que es quien ve la pantalla en la garita.
    const indicaciones = {
      NO_ROSTRO: 'No se detectó el rostro con claridad. Pida al estudiante que mire de frente a la cámara y oriente la cámara hacia su rostro, con buena iluminación.',
      VARIOS_ROSTROS: 'Hay más de un rostro en el encuadre. Pida que solo el titular quede frente a la cámara.',
    };
    setMensaje(indicaciones[error?.codigo] ?? error?.response?.data?.detail ?? error?.message ?? 'No se pudo verificar el rostro.');
  }

  async function autorizarManual(evento) {
    evento.preventDefault();
    if (!/^\d{8}$/.test(dni) || manual) return;
    setManual(true);
    setMensaje('');
    try {
      await retiroManual(bicicleta.idBicicleta, dni);
      alTerminar({ tipo: 'exito', resultado: 'MANUAL', texto: `Retiro manual autorizado con DNI: ${bicicleta.titular}. La bicicleta figura FUERA.` });
    } catch (error) {
      setMensaje(mensajeDeError(error, 'No se pudo registrar el retiro manual.'));
    } finally {
      setManual(false);
    }
  }

  function derivar() {
    alTerminar({
      tipo: 'aviso',
      resultado: 'DENEGADO',
      texto: 'Derivado al supervisor: verificar el DNI o carné del titular. La bicicleta permanece DENTRO.',
    });
  }

  function alternarLuz() {
    setLuzPantalla((actual) => {
      try { localStorage.setItem(CLAVE_LUZ, actual ? '0' : '1'); } catch { /* sin almacenamiento: solo esta sesión */ }
      return !actual;
    });
  }

  const modoLuz = luzPantalla && fase === 'buscando';
  const porcentaje = resultado ? Math.min(100, (resultado.distanciaEuclidiana / 1) * 100) : 0;

  const panelBusqueda = (
    <>
          {/* Nielsen H1: estado de la captura automática y qué corregir, en lenguaje del vigilante. */}
          <div className={estado?.apta ? 'exito' : 'aviso'} role="status" aria-live="polite" style={{ marginTop: 12 }}>
            {estado?.apta ? (
              <CheckCircle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
            ) : (
              <ScanFace size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
            )}
            <span>
              <strong>Captura automática:</strong> {estado?.mensaje ?? 'Buscando el rostro del estudiante…'}
              {estado?.apta && ` (${Math.min(estado.estables, estado.cuadrosEstables)}/${estado.cuadrosEstables})`}
            </span>
          </div>
          {diagnostico && estado?.metricas && (
            <p className="ayuda" data-testid="diagnostico-calidad" style={{ fontFamily: 'monospace' }}>
              {Object.entries(estado.metricas).map(([clave, valor]) => `${clave}: ${Number(valor).toFixed(2)}`).join(' · ')}
            </p>
          )}
          {demora && (
            <p className="ayuda" style={{ marginTop: 8 }}>
              La captura automática sigue intentando. {demora} Si no lo logra, capture manualmente o derive al supervisor.
            </p>
          )}
          <div className="con-boton" style={{ marginTop: 12 }}>
            {demora && (
              <button
                ref={botonCapturar}
                type="button"
                className="boton boton-primario"
                onClick={capturar}
                style={{ padding: '12px 24px', fontSize: '1rem' }}
              >
                <Camera size={20} aria-hidden="true" />
                Capturar y verificar
              </button>
            )}
            <button type="button" className="boton" aria-pressed={luzPantalla} onClick={alternarLuz}>
              <Sun size={18} aria-hidden="true" />
              {luzPantalla ? 'Apagar luz de pantalla' : 'Iluminar con la pantalla'}
            </button>
            <button type="button" className="boton" onClick={alCancelar}>
              Cancelar
            </button>
          </div>
          <p className="ayuda" style={{ marginTop: 4 }}>
            «Iluminar con la pantalla» sirve solo si la pantalla mira al estudiante; en la garita habitual, use una luz frontal.
          </p>
    </>
  );

  return (
    <section ref={seccion} className="ficha" aria-label="Verificación facial del retiro" style={{ marginTop: 16, background: '#fafbfa', border: '1px solid var(--verde-borde)' }}>
      <h2>
        <ScanFace size={22} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
        Verificación facial · Retiro
      </h2>

      {/* Visor de cámara con marco y guía ovalada superpuesta (SOLO CSS) */}
      <div className={`camara${modoLuz ? ' modo-luz' : ''}`}>
        <div className="camara-marco">
          <video ref={video} autoPlay muted playsInline aria-label="Video en vivo de la cámara" />
          <div className="camara-guia-ovalo" aria-hidden="true" />
        </div>
        {/* Observación del asesor (P07): quien mira la pantalla es el vigilante; el estudiante solo mira la cámara. */}
        <p className="aviso" style={{ marginTop: 8 }}>
          <Camera size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>
            <strong>Oriente la cámara hacia el rostro del estudiante</strong> y pídale que mire de frente a la cámara, sin gorra
            ni lentes, a unos 50–80 cm. El estudiante no ve la pantalla: solo debe mirar a la cámara.
          </span>
        </p>
        <p className="ayuda" style={{ textAlign: 'center', marginTop: 4 }}>
          Un único rostro dentro del óvalo, con buena iluminación. No se guarda ninguna imagen.
        </p>
        {modoLuz && panelBusqueda}
      </div>

      {fase === 'preparando' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 }}>
          <RefreshCw size={18} className="girando" aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
          <p role="status" style={{ margin: 0, fontWeight: 600 }}>Preparando el reconocimiento facial (más lento solo la primera vez)…</p>
        </div>
      )}

      {lento && (
        <p className="aviso" role="status">
          <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>La aceleración gráfica del navegador está desactivada y la verificación será lenta. En Chrome, active «Usar aceleración de gráficos cuando esté disponible» (Configuración → Sistema) y reinicie el navegador.</span>
        </p>
      )}

      {mensaje && (
        <p className="alerta" role="alert">
          <AlertTriangle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{mensaje}</span>
        </p>
      )}

      {/* Barra medidora con zona verde (θ ≤ umbral) y zona roja */}
      {resultado && (
        <div className="medidor" aria-label="Diferencia entre el rostro capturado y el registrado">
          <div className="medidor-barra">
            <span style={{ width: `${porcentaje}%` }} />
          </div>
          <p>
            <span>Diferencia con el rostro registrado: <strong>{resultado.distanciaEuclidiana.toFixed(2)}</strong></span>
            <span>Se acepta hasta {resultado.umbralTheta}</span>
          </p>
        </div>
      )}

      {fase === 'denegado' ? (
        <>
          <p className="alerta" role="alert">
            <XCircle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>
              Retiro denegado: el rostro no coincide con el del titular. La bicicleta permanece DENTRO y el intento quedó registrado.
            </span>
          </p>
          {resultado.alertaRevisionBiometrica && (
            <p className="aviso" role="alert">
              <ShieldAlert size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>
                Alerta de revisión biométrica: {resultado.rechazosConsecutivos} rechazos consecutivos para este titular. Verifique su
                identidad con DNI (derive al supervisor) y recomiende actualizar su enrolamiento facial en «Mi registro».
              </span>
            </p>
          )}
          <div className="con-boton">
            <button
              type="button"
              className="boton boton-primario"
              onClick={() => { setResultado(null); setFase('buscando'); }}
            >
              <RefreshCw size={18} aria-hidden="true" />
              Reintentar captura
            </button>
            {!permiteManual && (
              <button type="button" className="boton" onClick={derivar}>
                <ShieldAlert size={18} aria-hidden="true" />
                Derivar al supervisor
              </button>
            )}
            <button type="button" className="boton" onClick={alCancelar}>
              Cancelar
            </button>
          </div>
        </>
      ) : fase === 'buscando' ? (
        modoLuz ? null : panelBusqueda
      ) : (
        <div className="con-boton" style={{ marginTop: 12 }}>
          {(fase === 'lista' || fase === 'verificando') && (
          <button
            ref={botonCapturar}
            type="button"
            className="boton boton-primario"
            onClick={capturar}
            disabled={fase !== 'lista'}
            style={{ padding: '12px 24px', fontSize: '1rem' }}
          >
            <Camera size={20} aria-hidden="true" />
            {fase === 'verificando' ? 'Verificando…' : 'Capturar y verificar'}
          </button>
          )}
          {fase === 'lista' && (
            <button type="button" className="boton" onClick={() => setFase('buscando')}>
              <RefreshCw size={18} aria-hidden="true" />
              Reanudar captura automática
            </button>
          )}
          <button type="button" className="boton" onClick={alCancelar}>
            Cancelar
          </button>
        </div>
      )}

      {/* Formulario de Retiro Manual por el Supervisor */}
      {permiteManual && derivable && (
        <form className="ficha" onSubmit={autorizarManual} aria-label="Retiro manual del supervisor" style={{ marginTop: 20, borderLeft: '4px solid var(--azul-info)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={20} aria-hidden="true" style={{ color: 'var(--azul-info)' }} />
            <h3 style={{ margin: 0 }}>Retiro manual (Supervisor)</h3>
          </div>
          <p className="ayuda" style={{ marginTop: 8 }}>
            Solicite el DNI físico del titular. Si coincide con el registrado, la bicicleta pasa a FUERA y queda auditada como MANUAL.
          </p>
          <div className="campo">
            <label htmlFor="dni-titular">DNI del titular (8 dígitos)</label>
            <div className="con-boton" style={{ flexWrap: 'nowrap' }}>
              <input
                id="dni-titular"
                inputMode="numeric"
                maxLength={8}
                autoComplete="off"
                placeholder="12345678"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                style={{ fontSize: '1.1rem', letterSpacing: '0.1em' }}
              />
              <button
                type="submit"
                className="boton boton-primario"
                disabled={dni.length !== 8 || manual}
                style={{ whiteSpace: 'nowrap' }}
              >
                {manual ? 'Registrando…' : 'Autorizar retiro manual'}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
