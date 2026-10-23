import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';
import Confirmacion from '../../componentes/Confirmacion';
import { fechaPeru } from '../../componentes/formato';
import { mensajeDeError } from '../../services/apiClient';
import {
  conciliar,
  conciliarLote,
  importarCsv,
  listarPendientes,
  listarVigilantes,
  previsualizarCsv,
  previsualizarFila,
  registrarFila,
} from '../../services/contingenciasService';
import RevisarObservado from './RevisarObservado';
import { armarCsv, leerCsv } from './csvGarita';

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

/** W3 · Consola de Regularización (CU-06 con CC-08 y CC-10). Secciones 1-2-3 numeradas institucionales. */
export default function ConsolaContingencias() {
  const archivo = useRef(null);
  const [contenido, setContenido] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [previa, setPrevia] = useState(null);
  const [filasCsv, setFilasCsv] = useState(null); // filas editables del archivo (null si el encabezado no es el de la plantilla)
  const [editado, setEditado] = useState(0);
  const [fila, setFila] = useState(FILA_VACIA);
  const [verificacion, setVerificacion] = useState(null);
  const [vigilantes, setVigilantes] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(null); // { tipo: 'importar' } | { tipo: 'lote' } | { tipo: 'fila', item }
  const [revisando, setRevisando] = useState(null);

  const avisar = (tipo, texto) => setMensaje({ tipo, texto });
  const cargarPendientes = useCallback(async () => {
    try { setPendientes(await listarPendientes()); } catch (e) { avisar('alerta', mensajeDeError(e, 'No se pudo cargar el lote pendiente.')); }
  }, []);

  useEffect(() => {
    void cargarPendientes();
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

  async function validar(texto) {
    setOcupado(true);
    setMensaje(null);
    try {
      setPrevia(await previsualizarCsv(texto));
    } catch (e) {
      setPrevia(null);
      avisar('alerta', mensajeDeError(e, 'No se pudo validar el archivo.'));
    } finally {
      setOcupado(false);
    }
  }

  // Al elegir el archivo se valida solo: no hace falta un botón «Validar» (Nielsen H7).
  async function elegirArchivo(e) {
    const elegido = e.target.files?.[0];
    setPrevia(null);
    setFilasCsv(null);
    if (!elegido) { setContenido(''); setNombreArchivo(''); return; }
    setNombreArchivo(elegido.name);
    const original = await leerTexto(elegido);
    const { encabezadoValido, filas } = leerCsv(original);
    const texto = encabezadoValido ? armarCsv(filas) : original; // con otro encabezado, el servidor explica el error
    setFilasCsv(encabezadoValido ? filas : null);
    setContenido(texto);
    await validar(texto);
  }

  // Corrección en la misma vista previa: se edita solo el dato observado y la fila se vuelve a validar.
  function corregirCelda(indice, campo, valor) {
    setFilasCsv((filas) => filas.map((f, i) => (i === indice ? { ...f, [campo]: valor } : f)));
    setEditado((n) => n + 1);
  }

  useEffect(() => {
    if (!editado || !filasCsv) return undefined;
    const espera = setTimeout(() => {
      const texto = armarCsv(filasCsv);
      setContenido(texto);
      previsualizarCsv(texto).then(setPrevia).catch(() => {});
    }, 500);
    return () => clearTimeout(espera);
  }, [editado, filasCsv]);

  function cancelarArchivo() {
    setPrevia(null);
    setFilasCsv(null);
    setEditado(0);
    setContenido('');
    setNombreArchivo('');
    if (archivo.current) archivo.current.value = '';
  }

  // Un solo paso: importa las filas válidas y concilia el lote, tras una única confirmación.
  async function importarYConciliar() {
    const r = await importarCsv(contenido);
    const noCargadas = r.conError ? ` ${r.conError} filas con error no se cargaron.` : '';
    cancelarArchivo();
    try {
      const l = await conciliarLote();
      avisar(
        l.observados || l.conflictos || r.conError ? 'aviso' : 'exito',
        `Se importaron ${r.insertadas} filas y se procesó el lote: ${l.conciliados} CONCILIADO · ${l.observados} OBSERVADO · ${l.conflictos} conflictos.${noCargadas}${l.observados ? ' Resuelva los observados con «Revisar».' : ''}`,
      );
    } catch (e) {
      avisar('alerta', `Se importaron ${r.insertadas} filas, pero no se pudo conciliar el lote: ${mensajeDeError(e, 'reintente con «Conciliar lote».')}`);
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
      if (confirmar.tipo === 'importar') {
        await importarYConciliar();
      } else if (confirmar.tipo === 'lote') {
        const r = await conciliarLote();
        avisar(
          r.observados || r.conflictos ? 'aviso' : 'exito',
          `Lote procesado: ${r.conciliados} CONCILIADO · ${r.observados} OBSERVADO · ${r.conflictos} conflictos. Los observados se resuelven con «Revisar»; los conflictos quedan PENDIENTE con el motivo.`,
        );
      } else {
        const r = await conciliar(confirmar.item.idContingencia);
        avisar(
          r.resultado === 'CONCILIADO' ? 'exito' : 'aviso',
          r.resultado === 'CONCILIADO'
            ? `Folio ${r.folio} conciliado.`
            : r.resultado === 'OBSERVADO'
              ? `Caso OBSERVADO: el DNI anotado en el folio ${r.folio} no corresponde al titular. Resuélvalo con «Revisar».`
              : `No se pudo conciliar el folio ${r.folio}: el estado de la bicicleta no permite el movimiento. Verifique el folio.`,
        );
      }
      await cargarPendientes();
    } catch (e) {
      avisar('alerta', mensajeDeError(e, confirmar.tipo === 'importar' ? 'No se pudo importar el archivo.' : 'No se pudo conciliar.'));
    } finally {
      setOcupado(false);
      setConfirmar(null);
    }
  }

  const listas = previa?.filter((f) => f.valida).length ?? 0;
  const retirosListos = previa?.filter((f) => f.valida && f.tipo === 'RETIRO').length ?? 0;
  const cambiar = (campo) => (e) => setFila((f) => ({ ...f, [campo]: e.target.value }));
  const nPendientes = pendientes.filter((p) => p.estado === 'PENDIENTE').length;

  return (
    <main className="contenido">
      <div className="con-boton encabezado">
        <div>
          <h1>Consola de Regularización (Contingencias)</h1>
          <p className="ayuda" style={{ marginTop: -8 }}>
            Protocolo de conciliación de bitácoras físicas ante interrupciones de conectividad o energía
          </p>
        </div>
        <span className="etiqueta badge-pendiente" style={{ padding: '6px 14px' }}>
          <Clock size={16} aria-hidden="true" />
          ● Modo: registro diferido
        </span>
      </div>

      {mensaje && (
        <p className={mensaje.tipo} role={mensaje.tipo === 'alerta' ? 'alert' : 'status'}>
          {mensaje.tipo === 'exito' && <CheckCircle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />}
          {mensaje.tipo === 'aviso' && <AlertTriangle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />}
          {mensaje.tipo === 'alerta' && <XCircle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />}
          <span>{mensaje.texto}</span>
        </p>
      )}

      {/* SECCIÓN 1: IMPORTAR CSV DE GARITA */}
      <section className="ficha" aria-labelledby="t-importar" style={{ borderLeft: '4px solid var(--verde-ucsm)' }}>
        <div className="con-boton encabezado">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="paso-numero" style={{ background: 'var(--verde-ucsm)', color: '#ffffff' }}>1</div>
            <h2 id="t-importar" style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
              1. Importar el archivo de la garita (CSV)
            </h2>
          </div>
          <button type="button" className="boton-enlace" onClick={descargarPlantilla} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Download size={16} aria-hidden="true" />
            Descargar plantilla
          </button>
        </div>

        <div className="campo">
          <label htmlFor="csv">Archivo CSV exportado del Excel de la garita *</label>
          <div className="con-boton" style={{ flexWrap: 'nowrap' }}>
            <input
              id="csv"
              ref={archivo}
              type="file"
              accept=".csv,text/csv"
              onChange={elegirArchivo}
              style={{ padding: '8px 12px' }}
            />
            {ocupado && !previa && <span className="ayuda" role="status">Validando…</span>}
          </div>
          <p className="ayuda">
            Al elegir el archivo se valida automáticamente. Columnas: folio; fecha_hora; tipo; codigo (QR o N.º de marco); dni (solo retiro); vigilante. Separador «;» o «,», UTF-8.
          </p>
        </div>

        {previa && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--gris-200)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
              Vista previa — {nombreArchivo}
            </h3>
            <div className="tabla-desplazable">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Folio</th>
                    <th>Tipo</th>
                    <th>Bicicleta (autocompletada)</th>
                    <th>Fecha y hora</th>
                    <th>DNI</th>
                    <th>Validación</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.map((f) => {
                    const i = f.fila - 2;
                    const editable = !f.valida && filasCsv?.[i];
                    const celda = (campo, etiqueta, props = {}) => (
                      <input
                        aria-label={`${etiqueta} de la fila ${f.fila}`}
                        value={filasCsv[i][campo]}
                        onChange={(e) => corregirCelda(i, campo, e.target.value)}
                        style={{ minWidth: 0, width: '100%', padding: '4px 6px' }}
                        {...props}
                      />
                    );
                    return (
                      <tr key={f.fila} className={f.valida ? '' : 'fila-error'}>
                        <td><strong>{f.fila}</strong></td>
                        <td>{f.folio}</td>
                        <td>
                          {editable ? (
                            <select aria-label={`Tipo de la fila ${f.fila}`} value={filasCsv[i].tipo} onChange={(e) => corregirCelda(i, 'tipo', e.target.value)}>
                              <option value="INGRESO">INGRESO</option>
                              <option value="RETIRO">RETIRO</option>
                            </select>
                          ) : (
                            <span className={`etiqueta ${f.tipo === 'INGRESO' ? 'badge-dentro' : 'badge-manual'}`}>
                              {f.tipo}
                            </span>
                          )}
                        </td>
                        <td>{editable ? celda('codigo', 'Código', { maxLength: 60 }) : (f.bicicleta ?? <em>[{f.codigo || 'sin código'}]</em>)}</td>
                        <td>{editable ? celda('fecha_hora', 'Fecha y hora', { placeholder: 'dd/mm/aaaa hh:mm', maxLength: 16 }) : (f.fechaHoraUtc ? fechaPeru(f.fechaHoraUtc) : '—')}</td>
                        <td>{editable ? celda('dni', 'DNI', { inputMode: 'numeric', maxLength: 8, placeholder: '8 dígitos' }) : (f.dni ?? '—')}</td>
                        <td>
                          {f.valida ? (
                            <span className="etiqueta badge-exitoso">✓ Lista</span>
                          ) : (
                            <span className="etiqueta badge-denegado">✗ {f.error}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="con-boton" style={{ marginTop: 12 }}>
              <span className="etiqueta" style={{ padding: '6px 12px' }}>
                {listas} listas · {previa.length - listas} con error
              </span>
              <button type="button" className="boton" onClick={cancelarArchivo}>
                Cancelar
              </button>
              <button
                type="button"
                className="boton boton-primario"
                onClick={() => setConfirmar({ tipo: 'importar' })}
                disabled={listas === 0 || ocupado}
              >
                <CheckCircle size={18} aria-hidden="true" />
                Importar y conciliar {listas} filas
              </button>
            </div>
            <p className="ayuda" style={{ marginTop: 8 }}>
              {filasCsv
                ? 'Las filas con error se corrigen aquí mismo: cambie el dato observado y la fila se vuelve a validar. Las que sigan con error no se cargan.'
                : 'Las filas con error no se cargan: corríjalas en el bloque 2 («Agregar o corregir un movimiento»).'}
            </p>
          </div>
        )}
      </section>

      {/* SECCIÓN 2: AGREGAR O CORREGIR UN MOVIMIENTO (filas rechazadas, bitácora en papel o casos puntuales) */}
      <form className="ficha" aria-labelledby="t-manual" onSubmit={agregarFila} style={{ borderLeft: '4px solid #2b6cb0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div className="paso-numero" style={{ background: '#2b6cb0', color: '#ffffff' }}>2</div>
          <h2 id="t-manual" style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
            2. Agregar o corregir un movimiento
          </h2>
        </div>
        <p className="ayuda" style={{ margin: '-8px 0 16px' }}>
          Para la bitácora en papel o casos puntuales. Lo que agregue aquí entra al mismo lote que el archivo importado.
        </p>

        <div className="filtros" style={{ background: 'var(--gris-50)', padding: 16, margin: '0 0 16px' }}>
          <div className="campo">
            <label htmlFor="c-tipo">Tipo de movimiento *</label>
            <select id="c-tipo" className="selector" value={fila.tipo} onChange={cambiar('tipo')}>
              <option value="INGRESO">Ingreso</option>
              <option value="RETIRO">Retiro</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="c-codigo">Código QR o N.º de marco *</label>
            <input id="c-codigo" maxLength={60} value={fila.codigo} onChange={cambiar('codigo')} placeholder="UUID o serie de marco" />
          </div>
          <div className="campo">
            <label htmlFor="c-folio">Folio de bitácora *</label>
            <input id="c-folio" maxLength={20} value={fila.folio} onChange={cambiar('folio')} placeholder="Ej. B-0012" />
          </div>
          <div className="campo">
            <label htmlFor="c-fecha">Fecha y hora del movimiento *</label>
            <input id="c-fecha" type="datetime-local" value={fila.fechaHora} onChange={cambiar('fechaHora')} />
            <p className="ayuda">Sin fechas futuras; máximo 72 h atrás.</p>
          </div>
          {fila.tipo === 'RETIRO' && (
            <div className="campo">
              <label htmlFor="c-dni">DNI presentado *</label>
              <input
                id="c-dni"
                inputMode="numeric"
                maxLength={8}
                value={fila.dni}
                placeholder="8 dígitos"
                onChange={(e) => setFila((f) => ({ ...f, dni: e.target.value.replace(/\D/g, '') }))}
              />
            </div>
          )}
          <div className="campo">
            <label htmlFor="c-vigilante">Vigilante que anotó</label>
            <select id="c-vigilante" className="selector" value={fila.vigilante} onChange={cambiar('vigilante')}>
              <option value="">Seleccione…</option>
              {vigilantes.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {verificacion && (
          <p className={verificacion.valida ? 'aviso' : 'alerta'} role="status">
            {verificacion.valida ? <CheckCircle2 size={18} aria-hidden="true" style={{ flexShrink: 0 }} /> : <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />}
            <span>
              {verificacion.bicicleta ? `Verificación: ${verificacion.bicicleta} — Estado actual: ${verificacion.estadoBicicleta}. ` : ''}
              {verificacion.valida ? 'En un retiro, al conciliar se compara el DNI presentado con el del titular.' : verificacion.error}
            </span>
          </p>
        )}

        <button type="submit" className="boton boton-primario" disabled={!verificacion?.valida || ocupado}>
          <Plus size={18} aria-hidden="true" />
          Agregar al lote
        </button>
      </form>

      {/* SECCIÓN 3: LOTE PENDIENTE DE CONCILIACIÓN */}
      <section className="ficha" aria-labelledby="t-lote" style={{ borderLeft: '4px solid #b45309' }}>
        <div className="con-boton encabezado">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="paso-numero" style={{ background: '#b45309', color: '#ffffff' }}>3</div>
            <h2 id="t-lote" style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
              3. Lote pendiente de conciliación
            </h2>
          </div>
          <button
            type="button"
            className="boton boton-primario"
            disabled={nPendientes === 0 || ocupado}
            onClick={() => setConfirmar({ tipo: 'lote' })}
            style={{ padding: '10px 20px' }}
          >
            <CheckCircle size={18} aria-hidden="true" />
            Conciliar lote (orden cronológico)
          </button>
        </div>

        {pendientes.length === 0 ? (
          <p className="ayuda">No hay movimientos pendientes ni observados.</p>
        ) : (
          <div className="tabla-desplazable">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Origen</th>
                  <th>Tipo</th>
                  <th>Estudiante</th>
                  <th>Bicicleta</th>
                  <th>Fecha y hora manual</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((p) => (
                  <tr key={p.idContingencia}>
                    <td><strong>{p.folio}</strong></td>
                    <td><span className="etiqueta">{p.origen === 'CSV' ? 'CSV' : 'Manual'}</span></td>
                    <td>
                      <span className={`etiqueta ${p.tipo === 'INGRESO' ? 'badge-dentro' : 'badge-manual'}`}>
                        {p.tipo}
                      </span>
                    </td>
                    <td>{p.estudiante}</td>
                    <td>{p.bicicleta}</td>
                    <td>{fechaPeru(p.horaManualUtc)}</td>
                    <td>
                      <span className={`etiqueta ${p.estado === 'OBSERVADO' ? 'badge-observado' : 'badge-pendiente'}`}>
                        {p.estado === 'OBSERVADO' ? '⚠ OBSERVADO' : 'PENDIENTE'}
                      </span>
                      {p.motivo && <><br /><small style={{ color: 'var(--gris-600)' }}>{p.motivo}</small></>}
                    </td>
                    <td>
                      {p.estado === 'OBSERVADO' ? (
                        <button
                          type="button"
                          className="boton"
                          style={{ borderColor: '#c2410c', color: '#c2410c' }}
                          onClick={() => setRevisando(p.idContingencia)}
                        >
                          <Search size={16} aria-hidden="true" />
                          Revisar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="boton boton-primario"
                          onClick={() => setConfirmar({ tipo: 'fila', item: p })}
                        >
                          ✓ Conciliar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="ayuda" style={{ marginTop: 12 }}>
          Mostrando {nPendientes} pendientes y {pendientes.length - nPendientes} observados.
        </p>
      </section>

      {/* Diálogos de Confirmación y Revisión */}
      {confirmar && (
        <Confirmacion
          ocupado={ocupado}
          alCancelar={() => setConfirmar(null)}
          alConfirmar={ejecutarConfirmacion}
          titulo={
            confirmar.tipo === 'importar'
              ? `¿Importar y conciliar ${listas} movimientos?`
              : confirmar.tipo === 'lote' ? `¿Conciliar los ${nPendientes} movimientos pendientes?` : '¿Seguro que desea conciliar este movimiento?'
          }
        >
          <p>
            {confirmar.tipo === 'importar'
              ? `${listas - retirosListos} ingresos y ${retirosListos} retiros del archivo ${nombreArchivo}${previa && previa.length > listas ? `; ${previa.length - listas} filas con error no se cargarán` : ''}.${nPendientes ? ` También se conciliarán ${nPendientes} movimientos que ya estaban pendientes en el lote.` : ''} Se procesan en orden de fecha y hora y cada fila se concilia por separado; los retiros con DNI distinto quedan OBSERVADOS.`
              : confirmar.tipo === 'lote'
              ? 'Se procesan en orden de fecha y hora (los ingresos antes que los retiros). Cada fila se concilia por separado: si una falla, las demás no se afectan.'
              : `Folio ${confirmar.item.folio}: ${confirmar.item.tipo === 'INGRESO' ? 'la bicicleta pasará a DENTRO' : 'la bicicleta pasará a FUERA'}. Se registra en la auditoría como MANUAL.`}
          </p>
        </Confirmacion>
      )}

      {revisando && (
        <RevisarObservado
          idContingencia={revisando}
          alCerrar={() => setRevisando(null)}
          alTerminar={async (r) => {
            setRevisando(null);
            avisar(
              r.resultado === 'CONCILIADO' ? 'exito' : 'aviso',
              r.resultado === 'CONCILIADO' ? `Folio ${r.folio} conciliado.` : `Folio ${r.folio} permanece OBSERVADO y se deriva a Seguridad.`,
            );
            await cargarPendientes();
          }}
        />
      )}
    </main>
  );
}
