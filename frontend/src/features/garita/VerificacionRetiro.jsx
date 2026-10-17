import { useEffect, useRef, useState } from 'react';
import { cargarModelos, extraerDescriptor, obtenerFaceApi } from '../../biometria/extractorFacial';
import { autorizarRetiro } from '../../services/garitaService';

/**
 * CU-04 en W2: captura del rostro, extracción del descriptor en el navegador y decisión en la API.
 * El video solo se muestra en vivo: ningún fotograma se guarda ni se envía (Ley N.º 29733).
 */
export default function VerificacionRetiro({ bicicleta, inicioMs, alTerminar, alCancelar }) {
  const video = useRef(null);
  const flujo = useRef(null);
  const faceapi = useRef(null);
  const [fase, setFase] = useState('preparando');
  const [mensaje, setMensaje] = useState('');
  const [resultado, setResultado] = useState(null);

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
    preparar();
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
      descriptor.fill(0);   // se descarta también en el navegador
      setResultado(respuesta);
      if (respuesta.resultado === 'AUTORIZADO') {
        alTerminar({ tipo: 'exito', resultado: 'EXITOSO', texto: `Retiro autorizado: ${bicicleta.titular}. La bicicleta figura FUERA.` });
      } else {
        setFase('denegado');
      }
    } catch (error) {
      setFase('lista');
      setMensaje(error?.response?.data?.detail ?? error?.message ?? 'No se pudo verificar el rostro.');
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
    <section className="ficha" aria-label="Verificación facial del retiro">
      <h2>Verificación facial · Retiro</h2>
      <div className="camara">
        <video ref={video} autoPlay muted playsInline aria-label="Video en vivo de la cámara" />
        <p className="ayuda">Un único rostro, centrado y con buena iluminación. No se guarda ninguna imagen.</p>
      </div>
      {fase === 'preparando' && <p role="status">Cargando cámara y modelos…</p>}
      {mensaje && <p className="alerta" role="alert">{mensaje}</p>}

      {resultado && (
        <div className="medidor" aria-label="Distancia euclidiana">
          <div className="medidor-barra"><span style={{ width: `${porcentaje}%` }} /></div>
          <p>Distancia: <strong>{resultado.distanciaEuclidiana.toFixed(2)}</strong> — Umbral θ ≤ {resultado.umbralTheta}</p>
        </div>
      )}

      {fase === 'denegado' ? (
        <>
          <p className="alerta" role="alert">
            Retiro denegado: el rostro no coincide ({resultado.distanciaEuclidiana.toFixed(2)}). La bicicleta permanece DENTRO; el intento quedó registrado.
          </p>
          <div className="con-boton">
            <button type="button" className="boton boton-primario" onClick={() => { setResultado(null); setFase('lista'); }}>Reintentar captura</button>
            <button type="button" className="boton" onClick={derivar}>Derivar al supervisor</button>
          </div>
        </>
      ) : (
        <div className="con-boton">
          <button type="button" className="boton boton-primario" onClick={capturar} disabled={fase !== 'lista'}>
            {fase === 'verificando' ? 'Verificando…' : 'Capturar y verificar'}
          </button>
          <button type="button" className="boton" onClick={alCancelar}>Cancelar</button>
        </div>
      )}
    </section>
  );
}
