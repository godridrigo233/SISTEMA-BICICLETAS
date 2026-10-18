import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bike,
  Clock,
  Download,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
  XCircle,
  Zap,
} from 'lucide-react';
import Paginador from '../../componentes/Paginador';
import { fechaPeru } from '../../componentes/formato';
import { mensajeDeError } from '../../services/apiClient';
import { consultarEventos, exportarCsv, obtenerResumen } from '../../services/monitoreoService';

const VACIO = { tipo: '', resultado: '', registro: '', desde: '', hasta: '' };
const REGISTRO = { AUTOMATICO: 'Automático', CONTINGENCIA: 'Contingencia', DERIVACION: 'Derivación' };

function iconoKpi(titulo) {
  const props = { size: 20, 'aria-hidden': 'true', style: { flexShrink: 0 } };
  switch (titulo) {
    case 'Bicicletas DENTRO': return <Bike {...props} style={{ color: 'var(--verde-ucsm)' }} />;
    case 'Ingresos hoy': return <ArrowDownLeft {...props} style={{ color: 'var(--verde-ucsm)' }} />;
    case 'Retiros hoy': return <ArrowUpRight {...props} style={{ color: '#2b6cb0' }} />;
    case 'Rechazos hoy': return <XCircle {...props} style={{ color: 'var(--rojo-error)' }} />;
    case 'Movimientos manuales hoy': return <UserCheck {...props} style={{ color: '#b45309' }} />;
    case 'Contingencias por conciliar': return <Clock {...props} style={{ color: '#c2410c' }} />;
    case 'Latencia promedio hoy': return <Zap {...props} style={{ color: 'var(--verde-ucsm)' }} />;
    default: return <Activity {...props} />;
  }
}

/** W6 · Monitoreo y Reportes (Supervisor y Administrador). */
export default function MonitoreoPage() {
  const [resumen, setResumen] = useState(null);
  const [filtros, setFiltros] = useState(VACIO);
  const [aplicados, setAplicados] = useState(VACIO);
  const [numero, setNumero] = useState(1);
  const [pagina, setPagina] = useState(null);
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    setCargando(true);
    try {
      const [kpi, eventos] = await Promise.all([obtenerResumen(), consultarEventos({ ...aplicados, pagina: numero, tamano: 20 })]);
      setResumen(kpi);
      setPagina(eventos);
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo cargar el monitoreo.'));
    } finally {
      setCargando(false);
    }
  }, [aplicados, numero]);

  useEffect(() => { cargar(); }, [cargar]);

  const rangoInvalido = filtros.desde && filtros.hasta && filtros.desde > filtros.hasta;
  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));
  const filtrarManuales = () => { const f = { ...VACIO, resultado: 'MANUAL' }; setFiltros(f); setNumero(1); setAplicados(f); };

  async function exportar() {
    setExportando(true);
    try {
      await exportarCsv(aplicados);
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo exportar el CSV.'));
    } finally {
      setExportando(false);
    }
  }

  const kpis = resumen ? [
    ['Bicicletas DENTRO', resumen.bicicletasDentro],
    ['Ingresos hoy', resumen.ingresosHoy],
    ['Retiros hoy', resumen.retirosHoy],
    ['Rechazos hoy', resumen.rechazosHoy],
    ['Movimientos manuales hoy', resumen.movimientosManualesHoy],
    ['Contingencias por conciliar', resumen.contingenciasPendientes],
    ['Latencia promedio hoy', resumen.latenciaPromedioMsHoy == null ? '—' : `${(resumen.latenciaPromedioMsHoy / 1000).toFixed(2)} s`],
  ] : [];

  return (
    <main className="contenido">
      {/* Cabecera institucional */}
      <div className="con-boton encabezado">
        <div>
          <h1>Monitoreo y Reportes</h1>
          <p className="ayuda" style={{ marginTop: -8 }}>
            Panel ejecutivo e indicadores de rendimiento operativo en tiempo real
          </p>
        </div>
        <button type="button" className="boton" onClick={cargar} disabled={cargando}>
          <RefreshCw size={18} className={cargando ? 'girando' : ''} aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {/* Grid de KPIs con íconos institucionales */}
      <section className="kpis" aria-label="Indicadores del día">
        {kpis.map(([titulo, valor]) => (
          <div key={titulo} className="kpi">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{titulo}</span>
              {iconoKpi(titulo)}
            </div>
            <strong>{valor}</strong>
          </div>
        ))}
      </section>

      {resumen?.movimientosManualesHoy > 0 && (
        <div style={{ margin: '12px 0' }}>
          <button
            type="button"
            className="boton"
            style={{ borderColor: '#b45309', color: '#b45309', background: '#fffbeb' }}
            onClick={filtrarManuales}
          >
            <UserCheck size={18} aria-hidden="true" />
            Ver movimientos manuales
          </button>
        </div>
      )}

      {/* Barra de Filtros */}
      <form
        className="filtros"
        aria-label="Filtros de la bitácora"
        onSubmit={(e) => { e.preventDefault(); if (!rangoInvalido) { setNumero(1); setAplicados(filtros); } }}
      >
        <div className="campo">
          <label htmlFor="m-tipo">Tipo</label>
          <select id="m-tipo" className="selector" value={filtros.tipo} onChange={cambiar('tipo')}>
            <option value="">Todos</option>
            <option value="INGRESO">Ingreso</option>
            <option value="RETIRO">Retiro</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="m-resultado">Resultado</label>
          <select id="m-resultado" className="selector" value={filtros.resultado} onChange={cambiar('resultado')}>
            <option value="">Todos</option>
            <option value="EXITOSO">Exitoso</option>
            <option value="DENEGADO">Denegado</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="m-registro">Registro</label>
          <select id="m-registro" className="selector" value={filtros.registro} onChange={cambiar('registro')}>
            <option value="">Todos</option>
            <option value="AUTOMATICO">Automático</option>
            <option value="CONTINGENCIA">Contingencia</option>
            <option value="DERIVACION">Derivación</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="m-desde">Desde</label>
          <input id="m-desde" type="date" value={filtros.desde} onChange={cambiar('desde')} />
        </div>
        <div className="campo">
          <label htmlFor="m-hasta">Hasta</label>
          <input id="m-hasta" type="date" value={filtros.hasta} onChange={cambiar('hasta')} />
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
        <button
          type="button"
          className="boton"
          onClick={exportar}
          disabled={exportando || !pagina?.total}
        >
          <Download size={18} aria-hidden="true" />
          {exportando ? 'Exportando…' : 'Exportar CSV'}
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

      {/* Tabla de Eventos de Auditoría */}
      {pagina && pagina.total === 0 && (
        <div className="ficha" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Activity size={36} aria-hidden="true" style={{ color: 'var(--gris-400)', margin: '0 auto 12px' }} />
          <p className="ayuda" style={{ fontSize: '1rem' }}>No hay eventos para los filtros seleccionados.</p>
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
                <th>Distancia</th>
                <th>Latencia</th>
                <th>Bicicleta</th>
                <th>Cód. univ.</th>
                <th>Operador</th>
              </tr>
            </thead>
            <tbody>
              {pagina.elementos.map((e) => (
                <tr key={e.idAuditoria}>
                  <td><span style={{ fontWeight: 600 }}>{fechaPeru(e.fechaUtc)}</span></td>
                  <td>
                    <span className={`etiqueta ${e.tipoEvento === 'INGRESO' ? 'badge-dentro' : 'badge-manual'}`}>
                      {e.tipoEvento}
                    </span>
                  </td>
                  <td>
                    <span className={`etiqueta ${e.resultado === 'DENEGADO' ? 'badge-denegado' : e.resultado === 'MANUAL' ? 'badge-manual' : 'badge-exitoso'}`}>
                      {e.resultado === 'DENEGADO' ? '✗' : '✓'} {e.resultado}
                    </span>
                  </td>
                  <td>
                    <span className="etiqueta" style={{ background: 'var(--gris-100)', borderColor: 'var(--gris-200)' }}>
                      {REGISTRO[e.registro]}{e.folio ? ` · Folio ${e.folio}` : ''}
                    </span>
                  </td>
                  <td>
                    {e.distanciaEuclidiana == null ? '—' : (
                      <span className="codigo" style={{ fontSize: '0.85rem', padding: '2px 6px', borderRadius: 4 }}>
                        {e.distanciaEuclidiana.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td>
                    {e.latenciaMs == null ? '—' : (
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {e.latenciaMs} ms
                      </span>
                    )}
                  </td>
                  <td>{e.bicicleta}</td>
                  <td><span className="codigo" style={{ fontSize: '0.85rem', padding: '1px 6px', borderRadius: 4 }}>{e.codigoUniversitario}</span></td>
                  <td><small style={{ color: 'var(--gris-600)' }}>{e.operador}</small></td>
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
