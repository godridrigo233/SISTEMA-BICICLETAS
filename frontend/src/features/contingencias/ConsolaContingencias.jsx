import { useCallback, useEffect, useRef, useState } from 'react';
import Confirmacion from '../../componentes/Confirmacion';
import { fechaPeru } from '../../componentes/formato';
import { mensajeDeError } from '../../services/apiClient';
import {
  conciliar, conciliarLote, importarCsv, listarPendientes, listarVigilantes, previsualizarCsv, previsualizarFila, registrarFila,
} from '../../services/contingenciasService';
import RevisarObservado from './RevisarObservado';

const PLANTILLA = '﻿folio;fecha_hora;tipo;codigo;dni;vigilante\nE-0001;16/10/2026 10:15;INGRESO;[código QR o N.º de marco];;[correo del vigilante]\n';
const FILA_VACIA = { tipo: 'INGRESO', codigo: '', folio: '', fechaHora: '', dni: '', vigilante: '' };

/** Lee el archivo como texto (FileReader como respaldo en navegadores sin Blob.text). */
const leerTexto = (f) => (typeof f.text === 'function' ? f.text() : new Promise((resolver, rechazar) => {
  const lector = new FileReader();
  lector.onload = () => resolver(String(lector.result));
  lector.onerror = rechazar;
  lector.readAsText(f, 'utf-8');
}));

function descargarPlantilla() {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([PLANTILLA], { type: 'text/csv;charset=utf-8' }));
  enlace.download = 'plantilla_contingencia_garita.csv';
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

/** W3 · Consola de Regularización (CU-06 con CC-08 y CC-10). */
export default function ConsolaContingencias() {
  const archivo = useRef(null);
  const [contenido, setContenido] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [previa, setPrevia] = useState(null);
  const [fila, setFila] = useState(FILA_VACIA);
  const [verificacion, setVerificacion] = useState(null);
  const [vigilantes, setVigilantes] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(null);   // { tipo: 'lote' } | { tipo: 'fila', item }
  const [revisando, setRevisando] = useState(null);

  const avisar = (tipo, texto) => setMensaje({ tipo, texto });
  const cargarPendientes = useCallback(async () => {
    try { setPendientes(await listarPendientes()); } catch (e) { avisar('alerta', mensajeDeError(e, 'No se pudo cargar el lote pendiente.')); }
  }, []);

  useEffect(() => {
    cargarPendientes();
    listarVigilantes().then(setVigilantes).catch(() => setVigilantes([]));
  }, [cargarPendientes]);

  // Verificación en vivo del registro manual: autocompleta la bicicleta y anticipa errores (Nielsen H1 y H5).
  useEffect(() => {
    if (!fila.codigo.trim() || !fila.folio.trim() || !fila.fechaHora) { setVerificacion(null); return undefined; }
    const espera = setTimeout(() => {
      previsualizarFila(fila).then(setVerificacion).catch(() => setVerificacion(null));
    }, 400);
    return () => clearTimeout(espera);
  }, [fila]);

  async function elegirArchivo(e) {
    const elegido = e.target.files?.[0];
    setPrevia(null);
    if (!elegido) { setContenido(''); setNombreArchivo(''); return; }
    setNombreArchivo(elegido.name);
    setContenido(await leerTexto(elegido));
  }

  async function validarArchivo() {
    setOcupado(true);
    setMensaje(null);
    try {
      setPrevia(await previsualizarCsv(contenido));
    } catch (e) {
      avisar('alerta', mensajeDeError(e, 'No se pudo validar el archivo.'));
    } finally {
      setOcupado(false);
    }
  }

  function cancelarArchivo() {
    setPrevia(null);
    setContenido('');
    setNombreArchivo('');
    if (archivo.current) archivo.current.value = '';
  }

  async function agregarArchivo() {
    setOcupado(true);
    try {
      const r = await importarCsv(contenido);
      avisar('exito', `Se agregaron ${r.insertadas} filas al lote${r.conError ? ` (${r.conError} con error no se cargaron)` : ''}.`);
      cancelarArchivo();
      await cargarPendientes();
    } catch (e) {
      avisar('alerta', mensajeDeError(e, 'No se pudo importar el archivo.'));
    } finally {
      setOcupado(false);
    }
  }

  async function agregarFila(e) {
    e.preventDefault();
    if (!verificacion?.valida) return;
    setOcupado(true);
    try {
      await registrarFila({ ...fila, dni: fila.tipo === 'RETIRO' ? fila.dni : null, vigilante: fila.vigilante || null });
      avisar('exito', `Folio ${fila.folio} agregado al lote.`);
      setFila(FILA_VACIA);
      await cargarPendientes();
    } catch (err) {
      avisar('alerta', mensajeDeError(err, 'No se pudo agregar la fila.'));
    } finally {
      setOcupado(false);
    }
  }

  async function ejecutarConfirmacion() {
    setOcupado(true);
    try {
      if (confirmar.tipo === 'lote') {
        const r = await conciliarLote();
        avisar(r.observados || r.conflictos ? 'aviso' : 'exito',
          `Lote procesado: ${r.conciliados} CONCILIADO · ${r.observados} OBSERVADO · ${r.conflictos} conflictos. Los observados se resuelven con «Revisar»; los conflictos quedan PENDIENTE con el motivo.`);
      } else {
        const r = await conciliar(confirmar.item.idContingencia);
        avisar(r.resultado === 'CONCILIADO' ? 'exito' : 'aviso',
          r.resultado === 'CONCILIADO' ? `Folio ${r.folio} conciliado.`
            : r.resultado === 'OBSERVADO' ? `Caso OBSERVADO: el DNI anotado en el folio ${r.folio} no corresponde al titular. Resuélvalo con «Revisar».`
              : `No se pudo conciliar el folio ${r.folio}: el estado de la bicicleta no permite el movimiento. Verifique el folio.`);
      }
      await cargarPendientes();
    } catch (e) {
      avisar('alerta', mensajeDeError(e, 'No se pudo conciliar.'));
    } finally {
      setOcupado(false);
      setConfirmar(null);
    }
  }

  const listas = previa?.filter((f) => f.valida).length ?? 0;
  const cambiar = (campo) => (e) => setFila((f) => ({ ...f, [campo]: e.target.value }));
  const nPendientes = pendientes.filter((p) => p.estado === 'PENDIENTE').length;

  return (
    <main className="contenido">
      <div className="con-boton encabezado">
        <h1>Consola de Regularización (Contingencias)</h1>
        <span className="etiqueta">● Modo: registro diferido</span>
      </div>
      {mensaje && <p className={mensaje.tipo} role={mensaje.tipo === 'alerta' ? 'alert' : 'status'}>{mensaje.texto}</p>}

      <section className="ficha" aria-labelledby="t-importar">
        <div className="con-boton encabezado">
          <h2 id="t-importar">1. Importar el archivo de la garita (CSV)</h2>
          <button type="button" className="boton-enlace" onClick={descargarPlantilla}>Descargar plantilla</button>
        </div>
        <div className="campo">
          <label htmlFor="csv">Archivo CSV exportado del Excel de la garita *</label>
          <div className="con-boton">
            <input id="csv" ref={archivo} type="file" accept=".csv,text/csv" onChange={elegirArchivo} />
            <button type="button" className="boton" onClick={validarArchivo} disabled={!contenido || ocupado}>Validar archivo</button>
          </div>
          <p className="ayuda">Columnas: folio; fecha_hora; tipo; codigo (QR o N.º de marco); dni (solo retiro); vigilante. Separador «;» o «,», UTF-8.</p>
        </div>
        {previa && (
          <>
            <h3>Vista previa — {nombreArchivo}</h3>
            <div className="tabla-desplazable">
              <table className="tabla">
                <thead><tr><th>Fila</th><th>Folio</th><th>Tipo</th><th>Bicicleta (autocompletada)</th><th>Fecha y hora</th><th>DNI</th><th>Validación</th></tr></thead>
                <tbody>
                  {previa.map((f) => (
                    <tr key={f.fila} className={f.valida ? '' : 'fila-error'}>
                      <td>{f.fila}</td><td>{f.folio}</td><td>{f.tipo}</td><td>{f.bicicleta ?? <em>[{f.codigo || 'sin código'}]</em>}</td>
                      <td>{f.fechaHoraUtc ? fechaPeru(f.fechaHoraUtc) : '—'}</td><td>{f.dni ?? '—'}</td>
                      <td>{f.valida ? '✓ Lista' : `✗ ${f.error}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="con-boton">
              <span className="etiqueta">{listas} listas · {previa.length - listas} con error</span>
              <button type="button" className="boton" onClick={cancelarArchivo}>Cancelar</button>
              <button type="button" className="boton boton-primario" onClick={agregarArchivo} disabled={listas === 0 || ocupado}>
                Agregar {listas} filas al lote
              </button>
            </div>
            <p className="ayuda">Las filas con error no se cargan: corríjalas en el archivo o con el registro manual.</p>
          </>
        )}
      </section>

      <form className="ficha" aria-labelledby="t-manual" onSubmit={agregarFila}>
        <h2 id="t-manual">2. Registro manual (corrección o fila individual)</h2>
        <div className="filtros">
          <div className="campo"><label htmlFor="c-tipo">Tipo de movimiento *</label>
            <select id="c-tipo" className="selector" value={fila.tipo} onChange={cambiar('tipo')}>
              <option value="INGRESO">Ingreso</option><option value="RETIRO">Retiro</option>
            </select></div>
          <div className="campo"><label htmlFor="c-codigo">Código QR o N.º de marco *</label>
            <input id="c-codigo" maxLength={60} value={fila.codigo} onChange={cambiar('codigo')} /></div>
          <div className="campo"><label htmlFor="c-folio">Folio de bitácora *</label>
            <input id="c-folio" maxLength={20} value={fila.folio} onChange={cambiar('folio')} /></div>
          <div className="campo"><label htmlFor="c-fecha">Fecha y hora del movimiento *</label>
            <input id="c-fecha" type="datetime-local" value={fila.fechaHora} onChange={cambiar('fechaHora')} />
            <p className="ayuda">Sin fechas futuras; máximo 72 h atrás.</p></div>
          {fila.tipo === 'RETIRO' && (
            <div className="campo"><label htmlFor="c-dni">DNI presentado *</label>
              <input id="c-dni" inputMode="numeric" maxLength={8} value={fila.dni}
                onChange={(e) => setFila((f) => ({ ...f, dni: e.target.value.replace(/\D/g, '') }))} /></div>
          )}
          <div className="campo"><label htmlFor="c-vigilante">Vigilante que anotó</label>
            <select id="c-vigilante" className="selector" value={fila.vigilante} onChange={cambiar('vigilante')}>
              <option value="">Seleccione…</option>
              {vigilantes.map((v) => <option key={v} value={v}>{v}</option>)}
            </select></div>
        </div>
        {verificacion && (
          <p className={verificacion.valida ? 'aviso' : 'alerta'} role="status">
            {verificacion.bicicleta ? `Verificación: ${verificacion.bicicleta} — Estado actual: ${verificacion.estadoBicicleta}. ` : ''}
            {verificacion.valida ? 'En un retiro, al conciliar se compara el DNI presentado con el del titular.' : verificacion.error}
          </p>
        )}
        <button type="submit" className="boton boton-primario" disabled={!verificacion?.valida || ocupado}>Agregar al lote</button>
      </form>

      <section className="ficha" aria-labelledby="t-lote">
        <div className="con-boton encabezado">
          <h2 id="t-lote">3. Lote pendiente de conciliación</h2>
          <button type="button" className="boton boton-primario" disabled={nPendientes === 0 || ocupado} onClick={() => setConfirmar({ tipo: 'lote' })}>
            Conciliar lote (orden cronológico)
          </button>
        </div>
        {pendientes.length === 0 ? <p className="ayuda">No hay movimientos pendientes ni observados.</p> : (
          <div className="tabla-desplazable">
            <table className="tabla">
              <thead><tr><th>Folio</th><th>Origen</th><th>Tipo</th><th>Estudiante</th><th>Bicicleta</th><th>Fecha y hora manual</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>
                {pendientes.map((p) => (
                  <tr key={p.idContingencia}>
                    <td>{p.folio}</td><td>{p.origen === 'CSV' ? 'CSV' : 'Manual'}</td><td>{p.tipo}</td><td>{p.estudiante}</td><td>{p.bicicleta}</td>
                    <td>{fechaPeru(p.horaManualUtc)}</td>
                    <td>{p.estado === 'OBSERVADO' ? '⚠ OBSERVADO' : 'PENDIENTE'}{p.motivo && <><br /><small>{p.motivo}</small></>}</td>
                    <td>{p.estado === 'OBSERVADO'
                      ? <button type="button" className="boton" onClick={() => setRevisando(p.idContingencia)}>Revisar</button>
                      : <button type="button" className="boton" onClick={() => setConfirmar({ tipo: 'fila', item: p })}>✓ Conciliar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="ayuda">Mostrando {nPendientes} pendientes y {pendientes.length - nPendientes} observados.</p>
      </section>

      {confirmar && (
        <Confirmacion ocupado={ocupado} alCancelar={() => setConfirmar(null)} alConfirmar={ejecutarConfirmacion}
          titulo={confirmar.tipo === 'lote' ? `¿Conciliar los ${nPendientes} movimientos pendientes?` : '¿Seguro que desea conciliar este movimiento?'}>
          <p>{confirmar.tipo === 'lote'
            ? 'Se procesan en orden de fecha y hora (los ingresos antes que los retiros). Cada fila se concilia por separado: si una falla, las demás no se afectan.'
            : `Folio ${confirmar.item.folio}: ${confirmar.item.tipo === 'INGRESO' ? 'la bicicleta pasará a DENTRO' : 'la bicicleta pasará a FUERA'}. Se registra en la auditoría como MANUAL.`}</p>
        </Confirmacion>
      )}
      {revisando && (
        <RevisarObservado idContingencia={revisando} alCerrar={() => setRevisando(null)}
          alTerminar={async (r) => {
            setRevisando(null);
            avisar(r.resultado === 'CONCILIADO' ? 'exito' : 'aviso',
              r.resultado === 'CONCILIADO' ? `Folio ${r.folio} conciliado.` : `Folio ${r.folio} permanece OBSERVADO y se deriva a Seguridad.`);
            await cargarPendientes();
          }} />
      )}
    </main>
  );
}
