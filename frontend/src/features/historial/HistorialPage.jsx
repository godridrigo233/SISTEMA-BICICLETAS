import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bike,
  Calendar,
  CheckCircle,
  Filter,
  History,
  RotateCcw,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import Paginador from '../../componentes/Paginador';
import { fechaPeru } from '../../componentes/formato';
import { mensajeDeError } from '../../services/apiClient';
import { consultarHistorial, obtenerPerfil } from '../../services/estudianteService';

const VACIO = { tipo: '', desde: '', hasta: '' };
const ETIQUETA = { EXITOSO: '✓ Exitoso', DENEGADO: '✗ Denegado', MANUAL: '✓ Manual' };

/** W5 · Historial personal (CU-05): el estudiante consulta solo los movimientos de sus bicicletas. */
export default function HistorialPage() {
  const [filtros, setFiltros] = useState(VACIO);
  const [aplicados, setAplicados] = useState(VACIO);
  const [numero, setNumero] = useState(1);
  const [pagina, setPagina] = useState(null);
  const [error, setError] = useState('');
  const [perfil, setPerfil] = useState(null);

  const cargar = useCallback(async () => {
    setError('');
    try {
      setPagina(await consultarHistorial({ ...aplicados, pagina: numero, tamano: 10 }));
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo cargar el historial.'));
    }
  }, [aplicados, numero]);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => { obtenerPerfil().then(setPerfil).catch(() => setPerfil(null)); }, []);

  const rangoInvalido = filtros.desde && filtros.hasta && filtros.desde > filtros.hasta;
  const bicicletas = perfil?.bicicletas ?? [];
  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  function aplicar(evento) {
    evento.preventDefault();
    if (rangoInvalido) return;
    setNumero(1);
    setAplicados(filtros);
  }

  return (
    <main className="contenido garita">
      {/* Cabecera institucional */}
      <div className="con-boton encabezado">
        <div>
          <h1>Mi historial de movimientos</h1>
          <p className="ayuda" style={{ marginTop: -8 }}>
            Registro cronológico auditable de accesos y retiros de tus bicicletas registradas
          </p>
        </div>
      </div>

      {perfil && bicicletas.length === 0 && (
        <p className="aviso">
          <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>Aún no registras una bicicleta. Ve a «Mi registro» para obtener tu QR.</span>
        </p>
      )}

      {/* Estado de cada bicicleta propia; los stickers se descargan en «Mi registro». */}
      {bicicletas.length > 0 && (
        <section className="ficha" aria-label="Mis bicicletas" style={{ padding: '14px 20px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {bicicletas.map((b) => (
              <li key={b.codigoQr} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bike size={22} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
                  <p className="ayuda" style={{ margin: 0, fontSize: '0.95rem', color: 'var(--gris-800)' }}>
                    Bicicleta: <strong>{b.marcaModelo}</strong> ({b.color})
                  </p>
                </div>
                <span className={`etiqueta ${b.estado === 'DENTRO' ? 'badge-dentro' : 'badge-fuera'}`}>
                  {b.estado === 'DENTRO' ? <ArrowDownLeft size={14} aria-hidden="true" /> : <ArrowUpRight size={14} aria-hidden="true" />}
                  {b.estado}
                </span>
              </li>
            ))}
          </ul>
          <p className="ayuda" style={{ margin: '10px 0 0' }}>
            Tus stickers QR están en <a href="/estudiante/registro">Mi registro</a>.
          </p>
        </section>
      )}

      {/* Barra de Filtros */}
      <form className="filtros" onSubmit={aplicar} aria-label="Filtros del historial">
        <div className="campo">
          <label htmlFor="f-tipo">Tipo</label>
          <select id="f-tipo" className="selector" value={filtros.tipo} onChange={cambiar('tipo')}>
            <option value="">Todos</option>
            <option value="INGRESO">Ingreso</option>
            <option value="RETIRO">Retiro</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="f-desde">Desde</label>
          <input id="f-desde" type="date" value={filtros.desde} onChange={cambiar('desde')} />
        </div>
        <div className="campo">
          <label htmlFor="f-hasta">Hasta</label>
          <input id="f-hasta" type="date" value={filtros.hasta} onChange={cambiar('hasta')} />
        </div>
        <button type="submit" className="boton boton-primario" disabled={rangoInvalido}>
          <Filter size={18} aria-hidden="true" />
          Filtrar
        </button>
        <button
          type="button"
          className="boton"
          onClick={() => { setFiltros(VACIO); setNumero(1); setAplicados(VACIO); }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Limpiar
        </button>
      </form>

      {rangoInvalido && (
        <p className="alerta" role="alert">
          <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>La fecha «Desde» no puede ser posterior a «Hasta».</span>
        </p>
      )}

      {error && (
        <p className="alerta" role="alert">
          <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </p>
      )}

      {/* Resultados de la Bitácora */}
      {pagina && pagina.total === 0 && (
        <div className="ficha" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <History size={36} aria-hidden="true" style={{ color: 'var(--gris-400)', margin: '0 auto 12px' }} />
          <p className="ayuda" style={{ fontSize: '1rem' }}>No hay movimientos para los filtros seleccionados.</p>
        </div>
      )}

      {pagina && pagina.total > 0 && (
        <div className="tabla-desplazable">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Tipo</th>
                <th>Resultado</th>
                <th>Registro</th>
                <th>Bicicleta</th>
              </tr>
            </thead>
            <tbody>
              {pagina.elementos.map((m) => (
                <tr key={`${m.fechaUtc}-${m.tipoEvento}-${m.resultado}`}>
                  <td><span style={{ fontWeight: 600 }}>{fechaPeru(m.fechaUtc)}</span></td>
                  <td>
                    <span className={`etiqueta ${m.tipoEvento === 'INGRESO' ? 'badge-dentro' : 'badge-manual'}`}>
                      {m.tipoEvento}
                    </span>
                  </td>
                  <td>
                    <span className={`etiqueta ${m.resultado === 'DENEGADO' ? 'badge-denegado' : 'badge-exitoso'}`}>
                      {ETIQUETA[m.resultado]}
                    </span>
                  </td>
                  <td>
                    <span className="etiqueta" style={{ background: 'var(--gris-100)', borderColor: 'var(--gris-200)' }}>
                      {m.registro === 'MANUAL' ? 'Manual' : 'Automático'}
                    </span>
                  </td>
                  <td>{m.bicicleta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginador pagina={pagina} alCambiar={setNumero} />

    </main>
  );
}
