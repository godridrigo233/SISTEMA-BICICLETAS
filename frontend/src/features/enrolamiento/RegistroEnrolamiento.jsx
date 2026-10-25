import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  Camera,
  Check,
  CheckCircle,
  CheckCircle2,
  Download,
  FileCheck,
  QrCode,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  User,
} from 'lucide-react';
import { extraerDescriptor, prepararBiometria } from '../../biometria/extractorFacial';
import { mensajeDeError } from '../../services/apiClient';
import { enrolar, obtenerPerfil, registrarBicicleta } from '../../services/estudianteService';
import { descargarSticker, nombreAbreviado, qrComoDataUrl } from './sticker';

const COLORES = ['Negro', 'Blanco', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Gris', 'Naranja', 'Otro'];

/** W4 · Registro de bicicleta y enrolamiento facial (CU-01). Stepper visual decorativo. */
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
    // Precarga de los modelos mientras el estudiante llena el formulario (no activa la cámara).
    void prepararBiometria().catch(() => {});
  }, []);

  // La cámara solo se activa tras aceptar el consentimiento y se apaga al salir (Ley N.º 29733).
  useEffect(() => {
    if (!consentimiento || registrada) return undefined;
    let activo = true;
    void (async () => {
      try {
        setCamara('cargando');
        faceapi.current = await prepararBiometria();
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
  // Nielsen H1 y H5: lista visible de lo que falta para completar el registro.
  const requisitos = [
    ...(necesitaBici ? [
      ['Número de marco', Boolean(bici.numeroMarco.trim())],
      ['Marca y modelo', Boolean(bici.marcaModelo.trim())],
      ['Color', Boolean(bici.color)],
    ] : []),
    ['Aceptar el consentimiento', consentimiento],
    ['Capturar su rostro', Boolean(descriptor)],
  ];

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
      setDescriptor(null); // el vector ya no se conserva en el navegador
      setRegistrada(bicicleta);
      setQr(await qrComoDataUrl(bicicleta.codigoQr));
      setPerfil(await obtenerPerfil());
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo completar el registro.'));
    } finally {
      setEnviando(false);
    }
  }

  if (!perfil) {
    return (
      <main className="contenido">
        {error ? (
          <p className="alerta" role="alert">
            <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
            <RefreshCw size={24} className="girando" aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Cargando…</p>
          </div>
        )}
      </main>
    );
  }

  const nombre = nombreAbreviado(perfil.nombres, perfil.apellidos);

  // Pantalla de Éxito / Sticker QR
  if (registrada) {
    return (
      <main className="contenido garita">
        <div className="stepper-decorativo" aria-hidden="true">
          <div className="paso-item"><div className="paso-numero"><Check size={14} /></div> 1. Datos</div>
          <div className="paso-item"><div className="paso-numero"><Check size={14} /></div> 2. Bicicleta</div>
          <div className="paso-item"><div className="paso-numero"><Check size={14} /></div> 3. Captura</div>
          <div className="paso-item activo"><div className="paso-numero">4</div> 4. Sticker QR</div>
        </div>

        <h1>Registro y Enrolamiento</h1>
        <p className="exito" role="status">
          <CheckCircle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>Registro completado. Tu bicicleta quedó en estado FUERA.</span>
        </p>

        <section className="ficha" style={{ textAlign: 'center', padding: '32px 24px', borderTop: '4px solid var(--verde-ucsm)' }}>
          <h2 style={{ justifyContent: 'center' }}>
            <QrCode size={24} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
            Tu código QR
          </h2>
          <div style={{ background: '#ffffff', padding: 16, display: 'inline-block', borderRadius: 12, border: '2px solid var(--gris-200)', boxShadow: 'var(--sombra-md)', margin: '12px 0' }}>
            {qr && <img src={qr} alt={`Código QR de la bicicleta ${registrada.marcaModelo}`} width="220" height="220" style={{ display: 'block' }} />}
          </div>
          <p className="ayuda" style={{ fontSize: '0.95rem' }}>
            Código: <span className="codigo" style={{ padding: '2px 8px', borderRadius: 4 }}>{registrada.codigoQr}</span>
          </p>
          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              className="boton boton-primario"
              onClick={() => descargarSticker(registrada.codigoQr, nombre)}
              style={{ padding: '12px 28px', fontSize: '1.05rem' }}
            >
              <Download size={20} aria-hidden="true" />
              Descargar sticker QR
            </button>
          </div>
          <p className="ayuda" style={{ marginTop: 12, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
            Imprime y pega este sticker en el tubo superior o diagonal de tu bicicleta para el ingreso rápido en garita.
          </p>
        </section>
      </main>
    );
  }

  const cambiar = (campo) => (e) => setBici((b) => ({ ...b, [campo]: e.target.value }));

  // Formulario de Registro y Enrolamiento
  return (
    <main className="contenido garita">
      {/* Indicador de progreso visual (Nielsen H1) */}
      <div className="stepper-decorativo" aria-hidden="true">
        <div className="paso-item activo"><div className="paso-numero">1</div> 1. Datos</div>
        <div className={`paso-item ${biciValida ? 'activo' : ''}`}><div className="paso-numero">2</div> 2. Bicicleta</div>
        <div className={`paso-item ${consentimiento && descriptor ? 'activo' : ''}`}><div className="paso-numero">3</div> 3. Captura</div>
        <div className="paso-item"><div className="paso-numero">4</div> 4. Sticker QR</div>
      </div>

      <h1>Registro de Bicicleta y Enrolamiento Facial</h1>

      <form onSubmit={completar} className="garita" noValidate>
        {/* Paso 1: Padrón Institucional */}
        <section className="ficha" aria-label="Mis datos" style={{ borderLeft: '4px solid var(--verde-ucsm)' }}>
          <h2>
            <User size={20} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
            Mis datos (padrón institucional)
          </h2>
          <dl>
            <dt>Nombres</dt><dd>{perfil.nombres}</dd>
            <dt>Apellidos</dt><dd>{perfil.apellidos}</dd>
            <dt>Código universitario</dt><dd><span className="codigo" style={{ padding: '1px 6px', borderRadius: 4, fontSize: '0.9rem' }}>{perfil.codigoUniversitario}</span></dd>
            <dt>Facultad</dt><dd>{perfil.facultad}</dd>
          </dl>
        </section>

        {/* Paso 2: Datos de la Bicicleta */}
        {necesitaBici ? (
          <section className="ficha" aria-label="Datos de la bicicleta" style={{ borderLeft: '4px solid #2b6cb0' }}>
            <h2>
              <Bike size={20} aria-hidden="true" style={{ color: '#2b6cb0' }} />
              Datos de la bicicleta
            </h2>
            <div className="campo">
              <label htmlFor="marco">Número de marco (serie del chasis) *</label>
              <input id="marco" maxLength={40} value={bici.numeroMarco} onChange={cambiar('numeroMarco')} placeholder="Grabado bajo la caja del pedalier o tubo frontal" />
            </div>
            <div className="campo">
              <label htmlFor="marca">Marca y modelo *</label>
              <input id="marca" maxLength={50} value={bici.marcaModelo} onChange={cambiar('marcaModelo')} placeholder="Ej. Trek Marlin 5, Specialized Rockhopper" />
            </div>
            <div className="campo">
              <label htmlFor="color">Color *</label>
              <select id="color" className="selector" value={bici.color} onChange={cambiar('color')}>
                <option value="">Seleccione…</option>
                {COLORES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="rasgos">Características distintivas</label>
              <input id="rasgos" maxLength={100} value={bici.rasgosDistintivos} onChange={cambiar('rasgosDistintivos')} placeholder="Ej. parrilla trasera, luz delantera negra, timbre azul" />
              <p className="ayuda">{bici.rasgosDistintivos.length} / 100 caracteres</p>
            </div>
          </section>
        ) : (
          <p className="aviso">
            <CheckCircle2 size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>
              Bicicleta registrada: {perfil.bicicletas[0].marcaModelo} ({perfil.bicicletas[0].color}).
              {perfil.enrolado ? ' Ya tienes enrolamiento facial; puedes actualizarlo.' : ' Falta tu enrolamiento facial.'}
            </span>
          </p>
        )}

        {/* Paso 3: Consentimiento y Captura */}
        <section className="ficha" aria-label="Consentimiento y captura" style={{ borderLeft: '4px solid var(--verde-ucsm)' }}>
          <h2>
            <FileCheck size={20} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
            Consentimiento (Ley N.º 29733)
          </h2>
          <div style={{ background: 'var(--gris-50)', padding: 16, borderRadius: 8, border: '1px solid var(--gris-200)', marginBottom: 16 }}>
            <label className="con-boton" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={consentimiento}
                onChange={(e) => setConsentimiento(e.target.checked)}
                style={{ marginTop: 4, width: 20, height: 20 }}
              />
              <span style={{ fontSize: '0.95rem', lineHeight: 1.45 }}>
                Autorizo el tratamiento de mi descriptor biométrico facial con la única finalidad de verificar mi identidad al retirar mi bicicleta. No se almacenan fotografías.
              </span>
            </label>
          </div>

          {consentimiento && (
            <div className="camara" style={{ marginTop: 16 }}>
              <div className="camara-marco">
                <video ref={video} autoPlay muted playsInline aria-label="Visor de cámara en vivo" />
                <div className="camara-guia-ovalo" aria-hidden="true" />
              </div>

              {camara === 'cargando' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                  <RefreshCw size={16} className="girando" aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
                  <p role="status" style={{ margin: 0, fontWeight: 600 }}>Preparando el reconocimiento facial (más lento solo la primera vez)…</p>
                </div>
              )}

              {camara === 'sin-camara' && (
                <p className="alerta" role="alert">
                  <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span>No se detecta una cámara. Conecte o habilite la cámara e intente nuevamente.</span>
                </p>
              )}

              <p className="ayuda" style={{ textAlign: 'center' }}>
                Un único rostro, centrado, con buena iluminación y sin lentes oscuros ni mascarilla.
              </p>

              <button
                type="button"
                className="boton"
                onClick={capturar}
                disabled={camara !== 'activa'}
                style={{ marginTop: 8 }}
              >
                <Camera size={18} aria-hidden="true" />
                Capturar rostro
              </button>

              <p role="status" style={{ fontWeight: 600, color: descriptor ? 'var(--verde-ucsm)' : 'var(--gris-600)', marginTop: 8 }}>
                {descriptor ? '✓ Rostro capturado correctamente. Si desea, puede volver a capturarlo.' : 'Aún no ha capturado su rostro.'}
              </p>
            </div>
          )}
        </section>

        {error && (
          <p className="alerta" role="alert">
            <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </p>
        )}

        <button
          type="submit"
          className="boton boton-primario"
          disabled={!puedeEnviar}
          style={{ padding: '12px 24px', fontSize: '1.05rem', alignSelf: 'flex-start' }}
        >
          <ShieldCheck size={20} aria-hidden="true" />
          {enviando ? 'Guardando…' : 'Completar registro'}
        </button>
        {!puedeEnviar && !enviando && (
          <ul className="requisitos" aria-label="Pendiente para completar el registro">
            {requisitos.map(([texto, listo]) => (
              <li key={texto} className={listo ? 'listo' : ''}>
                {listo ? <CheckCircle2 size={16} aria-hidden="true" /> : <span className="pendiente" aria-hidden="true" />}
                {texto}
                <span className="sr-only">{listo ? ' (completo)' : ' (pendiente)'}</span>
              </li>
            ))}
          </ul>
        )}
      </form>
    </main>
  );
}
