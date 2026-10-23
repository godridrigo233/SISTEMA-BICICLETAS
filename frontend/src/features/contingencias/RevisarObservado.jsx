import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  FileText,
  Save,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { fechaPeru } from '../../componentes/formato';
import { mensajeDeError } from '../../services/apiClient';
import { obtenerDetalle, revisar } from '../../services/contingenciasService';

const OPCIONES = [
  ['ERROR_DIGITACION', 'Error de digitación', 'El DNI del folio físico difiere de lo transcrito. Se vuelve a comparar; si coincide → CONCILIADO.'],
  ['CONFIRMADO_TITULAR', 'Confirmado por el titular', 'El titular reconoce el retiro (propio o de un tercero autorizado) → CONCILIADO, auditoría MANUAL.'],
  ['NO_RECONOCE', 'El titular no reconoce el retiro', 'Posible sustracción: permanece OBSERVADO y se deriva a Seguridad.'],
];

// Motivos frecuentes por resolución: un clic completa el motivo, que sigue siendo editable (Nielsen H7).
const MOTIVOS = {
  ERROR_DIGITACION: ['DNI mal transcrito desde el folio físico', 'Dígitos invertidos al digitar el DNI'],
  CONFIRMADO_TITULAR: ['Titular confirmó el retiro por teléfono', 'Titular confirmó el retiro en persona', 'Retiro por un tercero autorizado por el titular'],
  NO_RECONOCE: ['Titular no reconoce el retiro; se deriva a Seguridad'],
};

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
        <div className="con-boton encabezado" style={{ borderBottom: '1px solid var(--gris-200)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={22} aria-hidden="true" style={{ color: '#c2410c' }} />
            <h2 id="titulo-revisar" style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
              Revisar retiro observado — Folio {detalle?.folio ?? '…'}
            </h2>
          </div>
          <button type="button" className="boton" aria-label="Cerrar" onClick={alCerrar} style={{ minWidth: 40, width: 40, height: 40, padding: 0 }}>
            <X size={18} aria-hidden="true" />
            <span style={{ display: 'none' }}>✕</span>
          </button>
        </div>

        {detalle && (
          <div className="kpis" style={{ margin: '16px 0' }}>
            <div className="kpi" style={{ borderLeftColor: '#c2410c' }}>
              <span>DNI anotado en la bitácora</span>
              <strong>{detalle.dniAnotado ?? '—'}</strong>
            </div>
            <div className="kpi" style={{ borderLeftColor: 'var(--verde-ucsm)' }}>
              <span>DNI del titular registrado</span>
              <strong>{detalle.dniTitularParcial}</strong>
              <small style={{ color: 'var(--gris-500)', marginTop: 4 }}>Mostrado parcialmente (Ley N.º 29733).</small>
            </div>
            <div className="kpi" style={{ borderLeftColor: '#2b6cb0' }}>
              <span>Titular: {detalle.titular}</span>
              <small>Contacto: {detalle.correoTitular}</small>
              <small>{detalle.bicicleta} — Marco {detalle.numeroMarco}</small>
              <small>{fechaPeru(detalle.horaManualUtc)}{detalle.vigilante ? ` — ${detalle.vigilante}` : ''}</small>
            </div>
          </div>
        )}

        <fieldset style={{ background: '#ffffff' }}>
          <legend>Resolución *</legend>
          {OPCIONES.map(([valor, titulo, ayuda]) => (
            <div
              key={valor}
              className="opcion"
              style={{
                borderColor: resolucion === valor ? 'var(--verde-ucsm)' : 'var(--gris-200)',
                background: resolucion === valor ? 'var(--verde-claro)' : '#ffffff',
              }}
            >
              <label>
                <input
                  type="radio"
                  name="resolucion"
                  value={valor}
                  checked={resolucion === valor}
                  onChange={() => setResolucion(valor)}
                />
                <strong>{titulo}</strong>
              </label>
              <p className="ayuda" style={{ margin: '4px 0 0 24px' }}>{ayuda}</p>
              {valor === 'ERROR_DIGITACION' && resolucion === valor && (
                <div className="campo" style={{ marginTop: 12, marginLeft: 24, maxWidth: 280 }}>
                  <label htmlFor="dni-corregido">DNI corregido</label>
                  <input
                    id="dni-corregido"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="8 dígitos"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              )}
            </div>
          ))}
        </fieldset>

        <div className="campo">
          <label htmlFor="motivo">Motivo u observación *</label>
          <textarea
            id="motivo"
            maxLength={160}
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: confirmado por llamada al titular el [dd/mm] a las [hh:mm]"
          />
          {resolucion && (
            <div className="con-boton" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }} aria-label="Motivos frecuentes">
              {MOTIVOS[resolucion].map((m) => (
                <button key={m} type="button" className="boton" style={{ padding: '4px 10px', fontSize: '0.85rem' }} onClick={() => setMotivo(m)}>
                  {m}
                </button>
              ))}
            </div>
          )}
          <p className="ayuda" style={{ textAlign: 'right' }}>{motivo.length} / 160 · elija un motivo frecuente o escriba uno propio</p>
        </div>

        {error && (
          <p className="alerta" role="alert">
            <AlertCircle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </p>
        )}

        <div className="con-boton" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="boton" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton boton-primario" disabled={!valido || guardando}>
            <Save size={18} aria-hidden="true" />
            {guardando ? 'Guardando…' : 'Guardar resolución'}
          </button>
        </div>
        <p className="ayuda" style={{ marginTop: 8 }}>
          Queda registrado el Supervisor, la fecha y la hora.
        </p>
      </form>
    </div>
  );
}
