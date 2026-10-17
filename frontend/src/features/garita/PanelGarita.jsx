import { useEffect, useRef, useState } from 'react';
import { consultarPorQr, registrarIngreso } from '../../services/garitaService';

const SIN_CONEXION = 'Sin conexión con el servidor. Aplique el protocolo de bitácora física; los movimientos se regularizarán en la Consola de Contingencias.';

function mensajeGarita(error) {
  if (!error?.response) return { tipo: 'aviso', texto: SIN_CONEXION };
  const { status, data } = error.response;
  if (status === 404) return { tipo: 'alerta', texto: 'Código no registrado. El identificador no corresponde a ninguna bicicleta.' };
  if (status === 400) return { tipo: 'alerta', texto: 'El código leído no tiene formato UUID. Vuelva a escanear o digítelo.' };
  return { tipo: 'alerta', texto: data?.detail ?? 'No se pudo completar la operación.' };
}

const hora = () => new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

/** W2 · Panel Central de Garita — ingreso por QR (CU-03). El retiro facial (CU-04) se incorpora después. */
export default function PanelGarita() {
  const campoQr = useRef(null);
  const botonIngreso = useRef(null);
  const inicio = useRef(0);
  const [codigo, setCodigo] = useState('');
  const [bicicleta, setBicicleta] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [movimientos, setMovimientos] = useState([]);

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
    inicio.current = performance.now();   // la latencia se mide desde la lectura del QR (RNF-01)
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

  async function ingresar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      await registrarIngreso(bicicleta.idBicicleta, Math.round(performance.now() - inicio.current));
      setMovimientos((m) => [{ hora: hora(), titular: bicicleta.titular, bici: `${bicicleta.marcaModelo} / ${bicicleta.color}`, tipo: 'INGRESO', resultado: 'EXITOSO' }, ...m].slice(0, 8));
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
      <h1>Panel Central de Garita</h1>
      <form onSubmit={consultar} className="campo">
        <label htmlFor="qr">Código QR de la bicicleta</label>
        <div className="con-boton">
          <input id="qr" ref={campoQr} autoComplete="off" maxLength={40} value={codigo} disabled={ocupado}
            onChange={(e) => setCodigo(e.target.value)} placeholder="Escanee el QR con el lector 2D" aria-describedby="ayuda-qr" />
          <button type="submit" className="boton" disabled={!codigo.trim() || ocupado}>Consultar</button>
        </div>
        <p id="ayuda-qr" className="ayuda">Formato UUID (36 caracteres). Si el QR es ilegible, puede digitarse (CU-03, 2a).</p>
      </form>

      {mensaje && <p className={mensaje.tipo} role={mensaje.tipo === 'exito' ? 'status' : 'alert'}>{mensaje.texto}</p>}

      {bicicleta && (
        <section className="ficha" aria-label="Bicicleta identificada">
          <h2>{bicicleta.titular} <small>· Código {bicicleta.codigoUniversitario}</small></h2>
          <dl>
            <dt>Marca y modelo</dt><dd>{bicicleta.marcaModelo}</dd>
            <dt>Color</dt><dd>{bicicleta.color}</dd>
            <dt>N.º de marco</dt><dd>{bicicleta.numeroMarco}</dd>
            <dt>Rasgos distintivos</dt><dd>{bicicleta.rasgosDistintivos || '—'}</dd>
            <dt>Estado actual</dt><dd><strong>{bicicleta.estado === 'DENTRO' ? '▣ DENTRO' : '⬚ FUERA'}</strong></dd>
          </dl>
          <p className="ayuda">Coteje visualmente la bicicleta con estos datos. No se almacenan fotografías.</p>
          {bicicleta.estado === 'FUERA' ? (
            <div className="con-boton">
              <button ref={botonIngreso} type="button" className="boton boton-primario" onClick={ingresar} disabled={ocupado}>
                Registrar ingreso
              </button>
              <button type="button" className="boton" onClick={reiniciar}>Cancelar</button>
            </div>
          ) : (
            <div className="con-boton">
              <p className="aviso">Operación: RETIRO → requiere verificación facial (disponible en el siguiente incremento).</p>
              <button type="button" className="boton" onClick={reiniciar}>Cancelar</button>
            </div>
          )}
        </section>
      )}

      <section aria-label="Últimos movimientos en esta garita">
        <h2>Últimos movimientos en esta garita</h2>
        {movimientos.length === 0 ? <p className="ayuda">Aún no hay movimientos en esta sesión.</p> : (
          <table className="tabla">
            <thead><tr><th>Hora</th><th>Estudiante</th><th>Bicicleta</th><th>Tipo</th><th>Resultado</th></tr></thead>
            <tbody>
              {movimientos.map((m, i) => (
                <tr key={`${m.hora}-${i}`}><td>{m.hora}</td><td>{m.titular}</td><td>{m.bici}</td><td>{m.tipo}</td><td>✓ {m.resultado}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
