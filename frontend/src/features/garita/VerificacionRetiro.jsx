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
  UserCheck,
  XCircle,
} from 'lucide-react';
import { cargarModelos, extraerDescriptor, obtenerFaceApi } from '../../biometria/extractorFacial';
import { autorizarRetiro, retiroManual } from '../../services/garitaService';
import { mensajeDeError } from '../../services/apiClient';

/**
 * CU-04 en W2: captura del rostro, extracción del descriptor en el navegador y decisión en la API.
 * El video solo se muestra en vivo: ningún fotograma se guarda ni se envía (Ley N.º 29733).
 */
export default function VerificacionRetiro({ bicicleta, inicioMs, alTerminar, alCancelar, permiteManual = false }) {
  const video = useRef(null);
  const flujo = useRef(null);
  const faceapi = useRef(null);
  const [fase, setFase] = useState('preparando');
  const [mensaje, setMensaje] = useState('');
  const [resultado, setResultado] = useState(null);
  const [derivable, setDerivable] = useState(false);
  const [dni, setDni] = useState('');
  const [manual, setManual] = useState(false);

  useEffect(() => {
    let activo = true;
    async function preparar() {
      try {
        faceapi.current = await obtenerFaceApi();
        await cargarModelos(faceapi.current);
        flujo.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (!activo) return;
        if (video.current) video.current.srcObject = flujo.current;
        setFase('lista');
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
      flujo.current?.getTracks().forEach((pista) => pista.stop());
    };
  }, []);

  async function capturar() {
    setFase('verificando');
    setMensaje('');
    try {
      const descriptor = await extraerDescriptor(video.current, faceapi.current);
      const respuesta = await autorizarRetiro(bicicleta.idBicicleta, descriptor, Math.round(performance.now() - inicioMs));
      descriptor.fill(0); // se descarta también en el navegador
      setResultado(respuesta);
      if (respuesta.resultado === 'AUTORIZADO') {
        alTerminar({ tipo: 'exito', resultado: 'EXITOSO', texto: `Retiro autorizado: ${bicicleta.titular}. La bicicleta figura FUERA.` });
      } else {
        setFase('denegado');
        setDerivable(true);
      }
    } catch (error) {
      setFase('lista');
      if (error?.response?.status === 409) setDerivable(true); // p. ej., titular sin enrolamiento
      setMensaje(error?.response?.data?.detail ?? error?.message ?? 'No se pudo verificar el rostro.');
    }
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

  const porcentaje = resultado ? Math.min(100, (resultado.distanciaEuclidiana / 1) * 100) : 0;

  return (
    <section className="ficha" aria-label="Verificación facial del retiro" style={{ marginTop: 16, background: '#fafbfa', border: '1px solid var(--verde-borde)' }}>
      <h2>
        <ScanFace size={22} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
        Verificación facial · Retiro
      </h2>

      {/* Visor de cámara con marco y guía ovalada superpuesta (SOLO CSS) */}
      <div className="camara">
        <div className="camara-marco">
          <video ref={video} autoPlay muted playsInline aria-label="Video en vivo de la cámara" />
          <div className="camara-guia-ovalo" aria-hidden="true" />
        </div>
        <p className="ayuda" style={{ textAlign: 'center', marginTop: 8 }}>
          Un único rostro, centrado y con buena iluminación. No se guarda ninguna imagen.
        </p>
      </div>

      {fase === 'preparando' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 }}>
          <RefreshCw size={18} className="girando" aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
          <p role="status" style={{ margin: 0, fontWeight: 600 }}>Cargando cámara y modelos…</p>
        </div>
      )}

      {mensaje && (
        <p className="alerta" role="alert">
          <AlertTriangle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{mensaje}</span>
        </p>
      )}

      {/* Barra medidora con zona verde (θ ≤ umbral) y zona roja */}
      {resultado && (
        <div className="medidor" aria-label="Distancia euclidiana">
          <div className="medidor-barra">
            <span style={{ width: `${porcentaje}%` }} />
          </div>
          <p>
            <span>Distancia: <strong>{resultado.distanciaEuclidiana.toFixed(2)}</strong></span>
            <span>Umbral θ ≤ {resultado.umbralTheta}</span>
          </p>
        </div>
      )}

      {fase === 'denegado' ? (
        <>
          <p className="alerta" role="alert">
            <XCircle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>
              Retiro denegado: el rostro no coincide ({resultado.distanciaEuclidiana.toFixed(2)}). La bicicleta permanece DENTRO; el intento quedó registrado.
            </span>
          </p>
          <div className="con-boton">
            <button
              type="button"
              className="boton boton-primario"
              onClick={() => { setResultado(null); setFase('lista'); }}
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
          </div>
        </>
      ) : (
        <div className="con-boton" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="boton boton-primario"
            onClick={capturar}
            disabled={fase !== 'lista'}
            style={{ padding: '12px 24px', fontSize: '1rem' }}
          >
            <Camera size={20} aria-hidden="true" />
            {fase === 'verificando' ? 'Verificando…' : 'Capturar y verificar'}
          </button>
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
