import { useEffect, useState } from 'react';
import { fechaPeru } from '../../componentes/formato';
import { mensajeDeError } from '../../services/apiClient';
import { obtenerDetalle, revisar } from '../../services/contingenciasService';

const OPCIONES = [
  ['ERROR_DIGITACION', 'Error de digitación', 'El DNI del folio físico difiere de lo transcrito. Se vuelve a comparar; si coincide → CONCILIADO.'],
  ['CONFIRMADO_TITULAR', 'Confirmado por el titular', 'El titular reconoce el retiro (propio o de un tercero autorizado) → CONCILIADO, auditoría MANUAL.'],
  ['NO_RECONOCE', 'El titular no reconoce el retiro', 'Posible sustracción: permanece OBSERVADO y se deriva a Seguridad.'],
];

/** Modal «Revisar» de un retiro OBSERVADO (W3, CC-08). */
export default function RevisarObservado({ idContingencia, alTerminar, alCerrar }) {
  const [detalle, setDetalle] = useState(null);
  const [resolucion, setResolucion] = useState('');
  const [dni, setDni] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerDetalle(idContingencia).then(setDetalle).catch((e) => setError(mensajeDeError(e, 'No se pudo cargar el caso.')));
  }, [idContingencia]);

  const valido = resolucion && motivo.trim().length >= 5 && (resolucion !== 'ERROR_DIGITACION' || /^\d{8}$/.test(dni));

  async function guardar(evento) {
    evento.preventDefault();
    if (!valido || guardando) return;
    setGuardando(true);
    setError('');
    try {
      const r = await revisar(idContingencia, { resolucion, motivo: motivo.trim(), dniCorregido: resolucion === 'ERROR_DIGITACION' ? dni : null });
      alTerminar(r);
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo guardar la resolución.'));
      setGuardando(false);
    }
  }

  return (
    <div className="modal-fondo">
      <form className="ficha modal modal-ancho" role="dialog" aria-modal="true" aria-labelledby="titulo-revisar" onSubmit={guardar}>
        <div className="con-boton encabezado">
          <h2 id="titulo-revisar">Revisar retiro observado — Folio {detalle?.folio ?? '…'}</h2>
          <button type="button" className="boton" aria-label="Cerrar" onClick={alCerrar}>✕</button>
        </div>
        {detalle && (
          <div className="kpis">
            <div className="kpi"><span>DNI anotado en la bitácora</span><strong>{detalle.dniAnotado ?? '—'}</strong></div>
            <div className="kpi"><span>DNI del titular registrado</span><strong>{detalle.dniTitularParcial}</strong>
              <small>Mostrado parcialmente (Ley N.º 29733).</small></div>
            <div className="kpi"><span>Titular: {detalle.titular}</span><small>Contacto: {detalle.correoTitular}</small>
              <small>{detalle.bicicleta} — Marco {detalle.numeroMarco}</small>
              <small>{fechaPeru(detalle.horaManualUtc)}{detalle.vigilante ? ` — ${detalle.vigilante}` : ''}</small></div>
          </div>
        )}
        <fieldset>
          <legend>Resolución *</legend>
          {OPCIONES.map(([valor, titulo, ayuda]) => (
            <div key={valor} className="opcion">
              <label><input type="radio" name="resolucion" value={valor} checked={resolucion === valor} onChange={() => setResolucion(valor)} /> <strong>{titulo}</strong></label>
              <p className="ayuda">{ayuda}</p>
              {valor === 'ERROR_DIGITACION' && resolucion === valor && (
                <div className="campo"><label htmlFor="dni-corregido">DNI corregido</label>
                  <input id="dni-corregido" inputMode="numeric" maxLength={8} value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))} /></div>
              )}
            </div>
          ))}
        </fieldset>
        <div className="campo">
          <label htmlFor="motivo">Motivo u observación *</label>
          <textarea id="motivo" maxLength={160} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: confirmado por llamada al titular el [dd/mm] a las [hh:mm]" />
          <p className="ayuda">{motivo.length} / 160</p>
        </div>
        {error && <p className="alerta" role="alert">{error}</p>}
        <div className="con-boton">
          <button type="button" className="boton" onClick={alCerrar}>Cancelar</button>
          <button type="submit" className="boton boton-primario" disabled={!valido || guardando}>{guardando ? 'Guardando…' : 'Guardar resolución'}</button>
        </div>
        <p className="ayuda">Queda registrado el Supervisor, la fecha y la hora.</p>
      </form>
    </div>
  );
}
