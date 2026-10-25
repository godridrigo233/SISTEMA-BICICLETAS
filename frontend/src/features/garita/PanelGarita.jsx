import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bike,
  Camera,
  CheckCircle,
  Clock,
  LogIn,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';
import { consultarPorQr, registrarIngreso } from '../../services/garitaService';
import VerificacionRetiro from './VerificacionRetiro';
import { prepararBiometria } from '../../biometria/extractorFacial';
import { useSesion } from '../auth/SesionContext';
import { ROL } from '../../app/rutasPorRol';

const SIN_CONEXION = 'Sin conexión con el servidor. Aplique el protocolo de bitácora física; los movimientos se regularizarán en la Consola de Contingencias.';

function mensajeGarita(error) {
  if (!error?.response) return { tipo: 'aviso', texto: SIN_CONEXION };
  const { status, data } = error.response;
  if (status === 404) return { tipo: 'alerta', texto: 'Código no registrado. El identificador no corresponde a ninguna bicicleta.' };
  if (status === 400) return { tipo: 'alerta', texto: 'El código leído no tiene formato UUID. Vuelva a escanear o digítelo.' };
  return { tipo: 'alerta', texto: data?.detail ?? 'No se pudo completar la operación.' };
}

const hora = () => new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

/** W2 · Panel Central de Garita: ingreso por QR (CU-03) y retiro con verificación facial (CU-04). */
export default function PanelGarita() {
  const sesion = useSesion()?.sesion;
  const campoQr = useRef(null);
  const botonIngreso = useRef(null);
  const inicio = useRef(0);
  const [codigo, setCodigo] = useState('');
  const [bicicleta, setBicicleta] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [movimientos, setMovimientos] = useState([]);

  // Precarga en segundo plano al abrir la garita: el primer retiro del turno no espera la descarga
  // ni la compilación de los modelos (RNF-01).
  useEffect(() => {
    const espera = setTimeout(() => { void prepararBiometria().catch(() => {}); }, 1500);
    return () => clearTimeout(espera);
  }, []);

  useEffect(() => {
    if (bicicleta?.estado === 'FUERA') botonIngreso.current?.focus();
    else campoQr.current?.focus();
  }, [bicicleta]);

  function reiniciar() {
    setCodigo('');
    setBicicleta(null);
    campoQr.current?.focus();
  }

  async function consultar(evento) {
    evento.preventDefault();
    if (!codigo.trim() || ocupado) return;
    inicio.current = performance.now(); // latencia del ingreso: desde la lectura del QR (RNF-01)
    setOcupado(true);
    setMensaje(null);
    try {
      setBicicleta(await consultarPorQr(codigo));
    } catch (e) {
      setBicicleta(null);
      setMensaje(mensajeGarita(e));
      setCodigo('');
    } finally {
      setOcupado(false);
    }
  }

  function terminarRetiro({ tipo, resultado, texto }) {
    setMovimientos((m) => [
      { hora: hora(), titular: bicicleta.titular, bici: `${bicicleta.marcaModelo} / ${bicicleta.color}`, tipo: 'RETIRO', resultado },
      ...m,
    ].slice(0, 8));
    setMensaje({ tipo, texto });
    reiniciar();
  }

  async function ingresar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      await registrarIngreso(bicicleta.idBicicleta, Math.round(performance.now() - inicio.current));
      setMovimientos((m) => [
        { hora: hora(), titular: bicicleta.titular, bici: `${bicicleta.marcaModelo} / ${bicicleta.color}`, tipo: 'INGRESO', resultado: 'EXITOSO' },
        ...m,
      ].slice(0, 8));
      setMensaje({ tipo: 'exito', texto: `Ingreso registrado: ${bicicleta.titular}. La bicicleta figura DENTRO.` });
      reiniciar();
    } catch (e) {
      setMensaje(mensajeGarita(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="contenido garita">
      <div className="con-boton encabezado" style={{ marginBottom: 8 }}>
        <div>
          <h1>Panel Central de Garita</h1>
          <p className="ayuda" style={{ marginTop: -8 }}>Lea el QR de la bicicleta: si está FUERA se registra su ingreso; si está DENTRO, se verifica el rostro de quien la retira.</p>
        </div>
      </div>

      {/* Buscador de QR de alta visibilidad para el vigilante */}
      <section className="ficha" style={{ borderTop: '4px solid var(--verde-ucsm)' }}>
        <form onSubmit={consultar} className="campo" style={{ marginBottom: 0 }}>
          <label htmlFor="qr" style={{ fontSize: '1.05rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <QrCode size={20} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
            Código QR de la bicicleta
          </label>
          <div className="con-boton" style={{ flexWrap: 'nowrap' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                id="qr"
                ref={campoQr}
                autoComplete="off"
                maxLength={40}
                value={codigo}
                disabled={ocupado}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Escanee el QR con el lector 2D"
                aria-describedby="ayuda-qr"
                style={{ fontSize: '1.15rem', padding: '12px 16px 12px 42px', minHeight: 52 }}
              />
              <Search
                size={20}
                aria-hidden="true"
                style={{ position: 'absolute', left: 14, top: 16, color: 'var(--gris-400)', pointerEvents: 'none' }}
              />
            </div>
            <button
              type="submit"
              className="boton boton-primario"
              disabled={!codigo.trim() || ocupado}
              style={{ minHeight: 52, padding: '0 28px', fontSize: '1rem' }}
            >
              <Search size={18} aria-hidden="true" />
              Consultar
            </button>
          </div>
          <p id="ayuda-qr" className="ayuda" style={{ marginTop: 8 }}>
            Si el lector no logra leer el sticker, escriba el código impreso debajo del QR y pulse Enter.
          </p>
        </form>
      </section>

      {mensaje && (
        <p className={mensaje.tipo} role={mensaje.tipo === 'exito' ? 'status' : 'alert'}>
          {mensaje.tipo === 'exito' && <CheckCircle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />}
          {mensaje.tipo === 'aviso' && <AlertTriangle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />}
          {mensaje.tipo === 'alerta' && <XCircle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />}
          <span>{mensaje.texto}</span>
        </p>
      )}

      {/* Ficha de Bicicleta Identificada */}
      {bicicleta && (
        <section className="ficha" aria-label="Bicicleta identificada" style={{ borderLeft: '4px solid var(--verde-ucsm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <h2>
              <User size={22} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
              {bicicleta.titular} <small>· Código {bicicleta.codigoUniversitario}</small>
            </h2>
            <span
              className={`etiqueta ${bicicleta.estado === 'DENTRO' ? 'badge-dentro' : 'badge-fuera'}`}
              style={{ fontSize: '0.9rem', padding: '6px 14px' }}
            >
              {bicicleta.estado === 'DENTRO' ? (
                <>
                  <ArrowDownLeft size={16} aria-hidden="true" />
                  DENTRO DEL CAMPUS
                </>
              ) : (
                <>
                  <ArrowUpRight size={16} aria-hidden="true" />
                  FUERA DEL CAMPUS
                </>
              )}
            </span>
          </div>

          <dl>
            <dt>Marca y modelo</dt><dd>{bicicleta.marcaModelo}</dd>
            <dt>Color</dt><dd>{bicicleta.color}</dd>
            <dt>N.º de marco</dt><dd><span className="codigo" style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.9rem' }}>{bicicleta.numeroMarco}</span></dd>
            <dt>Rasgos distintivos</dt><dd>{bicicleta.rasgosDistintivos || '—'}</dd>
            <dt>Estado actual</dt><dd><strong>{bicicleta.estado === 'DENTRO' ? '▣ DENTRO' : '⬚ FUERA'}</strong></dd>
          </dl>

          <p className="ayuda" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={16} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
            Coteje visualmente la bicicleta con estos datos. No se almacenan fotografías.
          </p>

          {bicicleta.estado === 'FUERA' ? (
            <div className="con-boton" style={{ marginTop: 16 }}>
              <button
                ref={botonIngreso}
                type="button"
                className="boton boton-primario"
                onClick={ingresar}
                disabled={ocupado}
                style={{ padding: '12px 24px', fontSize: '1.05rem' }}
              >
                <LogIn size={20} aria-hidden="true" />
                Registrar ingreso
              </button>
              <button type="button" className="boton" onClick={reiniciar}>
                Cancelar
              </button>
            </div>
          ) : (
            <VerificacionRetiro
              bicicleta={bicicleta}
              alTerminar={terminarRetiro}
              alCancelar={reiniciar}
              permiteManual={[ROL.SUPERVISOR, ROL.ADMINISTRADOR].includes(sesion?.idRol)}
            />
          )}
        </section>
      )}

      {/* Tabla de Últimos Movimientos */}
      <section className="ficha" aria-label="Últimos movimientos en esta garita">
        <h2>
          <Clock size={20} aria-hidden="true" style={{ color: 'var(--gris-600)' }} />
          Últimos movimientos en esta garita
        </h2>
        {movimientos.length === 0 ? (
          <p className="ayuda">Aún no hay movimientos en esta sesión.</p>
        ) : (
          <div className="tabla-desplazable" style={{ margin: '8px 0 0' }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Estudiante</th>
                  <th>Bicicleta</th>
                  <th>Tipo</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m, i) => (
                  <tr key={`${m.hora}-${i}`}>
                    <td><span style={{ fontWeight: 600 }}>{m.hora}</span></td>
                    <td>{m.titular}</td>
                    <td>{m.bici}</td>
                    <td>
                      <span className={`etiqueta ${m.tipo === 'INGRESO' ? 'badge-dentro' : 'badge-manual'}`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td>
                      <span className={`etiqueta ${m.resultado === 'DENEGADO' ? 'badge-denegado' : 'badge-exitoso'}`}>
                        {m.resultado === 'DENEGADO' ? '✗' : '✓'} {m.resultado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
