import { useEffect, useRef, useState } from 'react';
import { cargarModelos, extraerDescriptor, obtenerFaceApi } from '../../biometria/extractorFacial';
import { mensajeDeError } from '../../services/apiClient';
import { enrolar, obtenerPerfil, registrarBicicleta } from '../../services/estudianteService';
import { descargarSticker, nombreAbreviado, qrComoDataUrl } from './sticker';

const COLORES = ['Negro', 'Blanco', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Gris', 'Naranja', 'Otro'];

/** W4 · Registro de bicicleta y enrolamiento facial (CU-01). */
export default function RegistroEnrolamiento() {
  const video = useRef(null);
  const flujo = useRef(null);
  const faceapi = useRef(null);
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState('');
  const [bici, setBici] = useState({ numeroMarco: '', marcaModelo: '', color: '', rasgosDistintivos: '' });
  const [consentimiento, setConsentimiento] = useState(false);
  const [camara, setCamara] = useState('espera');
  const [descriptor, setDescriptor] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [registrada, setRegistrada] = useState(null);
  const [qr, setQr] = useState('');

  useEffect(() => {
    obtenerPerfil().then(setPerfil).catch((e) => setError(mensajeDeError(e, 'No se pudo cargar su perfil.')));
  }, []);

  // La cámara solo se activa tras aceptar el consentimiento y se apaga al salir (Ley N.º 29733).
  useEffect(() => {
    if (!consentimiento || registrada) return undefined;
    let activo = true;
    (async () => {
      try {
        setCamara('cargando');
        faceapi.current = await obtenerFaceApi();
        await cargarModelos(faceapi.current);
        flujo.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (!activo) return;
        if (video.current) video.current.srcObject = flujo.current;
        setCamara('activa');
      } catch {
        if (activo) setCamara('sin-camara');
      }
    })();
    return () => {
      activo = false;
      flujo.current?.getTracks().forEach((p) => p.stop());
    };
  }, [consentimiento, registrada]);

  const necesitaBici = perfil && perfil.bicicletas.length === 0;
  const biciValida = !necesitaBici || (bici.numeroMarco.trim() && bici.marcaModelo.trim() && bici.color);
  const puedeEnviar = biciValida && consentimiento && descriptor && !enviando;

  async function capturar() {
    setError('');
    try {
      setDescriptor(await extraerDescriptor(video.current, faceapi.current));
    } catch (e) {
      setDescriptor(null);
      setError(e.message);
    }
  }

  async function completar(evento) {
    evento.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    setError('');
    try {
      const bicicleta = necesitaBici ? await registrarBicicleta({ ...bici, rasgosDistintivos: bici.rasgosDistintivos.trim() || null }) : perfil.bicicletas[0];
      await enrolar(descriptor);
      setDescriptor(null);   // el vector ya no se conserva en el navegador
      setRegistrada(bicicleta);
      setQr(await qrComoDataUrl(bicicleta.codigoQr));
      setPerfil(await obtenerPerfil());
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo completar el registro.'));
    } finally {
      setEnviando(false);
    }
  }

  if (!perfil) return <main className="contenido">{error ? <p className="alerta" role="alert">{error}</p> : <p>Cargando…</p>}</main>;
  const nombre = nombreAbreviado(perfil.nombres, perfil.apellidos);

  if (registrada) {
    return (
      <main className="contenido garita">
        <h1>Registro y Enrolamiento</h1>
        <p className="exito" role="status">Registro completado. Tu bicicleta quedó en estado FUERA.</p>
        <section className="ficha">
          <h2>Tu código QR</h2>
          {qr && <img src={qr} alt={`Código QR de la bicicleta ${registrada.marcaModelo}`} width="220" height="220" />}
          <p className="ayuda">Código: {registrada.codigoQr}</p>
          <button type="button" className="boton boton-primario" onClick={() => descargarSticker(registrada.codigoQr, nombre)}>
            Descargar sticker QR
          </button>
        </section>
      </main>
    );
  }

  const cambiar = (campo) => (e) => setBici((b) => ({ ...b, [campo]: e.target.value }));
  return (
    <main className="contenido garita">
      <h1>Registro de Bicicleta y Enrolamiento Facial</h1>
      <form onSubmit={completar} className="garita" noValidate>
        <section className="ficha" aria-label="Mis datos">
          <h2>Mis datos (padrón institucional)</h2>
          <dl>
            <dt>Nombres</dt><dd>{perfil.nombres}</dd>
            <dt>Apellidos</dt><dd>{perfil.apellidos}</dd>
            <dt>Código universitario</dt><dd>{perfil.codigoUniversitario}</dd>
            <dt>Facultad</dt><dd>{perfil.facultad}</dd>
          </dl>
        </section>

        {necesitaBici ? (
          <section className="ficha" aria-label="Datos de la bicicleta">
            <h2>Datos de la bicicleta</h2>
            <div className="campo"><label htmlFor="marco">Número de marco (serie del chasis) *</label>
              <input id="marco" maxLength={40} value={bici.numeroMarco} onChange={cambiar('numeroMarco')} /></div>
            <div className="campo"><label htmlFor="marca">Marca y modelo *</label>
              <input id="marca" maxLength={50} value={bici.marcaModelo} onChange={cambiar('marcaModelo')} /></div>
            <div className="campo"><label htmlFor="color">Color *</label>
              <select id="color" className="selector" value={bici.color} onChange={cambiar('color')}>
                <option value="">Seleccione…</option>
                {COLORES.map((c) => <option key={c}>{c}</option>)}
              </select></div>
            <div className="campo"><label htmlFor="rasgos">Características distintivas</label>
              <input id="rasgos" maxLength={100} value={bici.rasgosDistintivos} onChange={cambiar('rasgosDistintivos')} />
              <p className="ayuda">{bici.rasgosDistintivos.length} / 100 caracteres</p></div>
          </section>
        ) : (
          <p className="aviso">Bicicleta registrada: {perfil.bicicletas[0].marcaModelo} ({perfil.bicicletas[0].color}).
            {perfil.enrolado ? ' Ya tienes enrolamiento facial; puedes actualizarlo.' : ' Falta tu enrolamiento facial.'}</p>
        )}

        <section className="ficha" aria-label="Consentimiento y captura">
          <h2>Consentimiento (Ley N.º 29733)</h2>
          <label className="con-boton">
            <input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
            Autorizo el tratamiento de mi descriptor biométrico facial con la única finalidad de verificar mi identidad al retirar mi bicicleta. No se almacenan fotografías.
          </label>
          {consentimiento && (
            <div className="camara">
              <video ref={video} autoPlay muted playsInline aria-label="Visor de cámara en vivo" />
              {camara === 'cargando' && <p role="status">Cargando cámara y modelos…</p>}
              {camara === 'sin-camara' && <p className="alerta" role="alert">No se detecta una cámara. Conecte o habilite la cámara e intente nuevamente.</p>}
              <p className="ayuda">Un único rostro, centrado, con buena iluminación y sin lentes oscuros ni mascarilla.</p>
              <button type="button" className="boton" onClick={capturar} disabled={camara !== 'activa'}>Capturar rostro</button>
              <p>Descriptor: {descriptor ? 'capturado (128 / 128)' : 'no capturado (0 / 128)'}</p>
            </div>
          )}
        </section>

        {error && <p className="alerta" role="alert">{error}</p>}
        <button type="submit" className="boton boton-primario" disabled={!puedeEnviar}>
          {enviando ? 'Guardando…' : 'Completar registro'}
        </button>
        <p className="ayuda">Requiere datos de la bicicleta válidos, consentimiento aceptado y descriptor capturado.</p>
      </form>
    </main>
  );
}
