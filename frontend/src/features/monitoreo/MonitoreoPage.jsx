import { useCallback, useEffect, useState } from 'react';
import Paginador from '../../componentes/Paginador';
import { fechaPeru } from '../../componentes/formato';
import { mensajeDeError } from '../../services/apiClient';
import { consultarEventos, exportarCsv, obtenerResumen } from '../../services/monitoreoService';

const VACIO = { tipo: '', resultado: '', registro: '', desde: '', hasta: '' };
const REGISTRO = { AUTOMATICO: 'Automático', CONTINGENCIA: 'Contingencia', DERIVACION: 'Derivación' };

/** W6 · Monitoreo y Reportes (Supervisor y Administrador). */
export default function MonitoreoPage() {
  const [resumen, setResumen] = useState(null);
  const [filtros, setFiltros] = useState(VACIO);
  const [aplicados, setAplicados] = useState(VACIO);
  const [numero, setNumero] = useState(1);
  const [pagina, setPagina] = useState(null);
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [kpi, eventos] = await Promise.all([obtenerResumen(), consultarEventos({ ...aplicados, pagina: numero, tamano: 20 })]);
      setResumen(kpi);
      setPagina(eventos);
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo cargar el monitoreo.'));
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
      <div className="con-boton encabezado">
        <h1>Monitoreo y Reportes</h1>
        <button type="button" className="boton" onClick={cargar}>Actualizar</button>
      </div>
      <section className="kpis" aria-label="Indicadores del día">
        {kpis.map(([titulo, valor]) => (
          <div key={titulo} className="kpi"><span>{titulo}</span><strong>{valor}</strong></div>
        ))}
      </section>
      {resumen?.movimientosManualesHoy > 0 && (
        <button type="button" className="boton" onClick={filtrarManuales}>Ver movimientos manuales</button>
      )}

      <form className="filtros" aria-label="Filtros de la bitácora"
        onSubmit={(e) => { e.preventDefault(); if (!rangoInvalido) { setNumero(1); setAplicados(filtros); } }}>
        <div className="campo"><label htmlFor="m-tipo">Tipo</label>
          <select id="m-tipo" className="selector" value={filtros.tipo} onChange={cambiar('tipo')}>
            <option value="">Todos</option><option value="INGRESO">Ingreso</option><option value="RETIRO">Retiro</option>
          </select></div>
        <div className="campo"><label htmlFor="m-resultado">Resultado</label>
          <select id="m-resultado" className="selector" value={filtros.resultado} onChange={cambiar('resultado')}>
            <option value="">Todos</option><option value="EXITOSO">Exitoso</option><option value="DENEGADO">Denegado</option><option value="MANUAL">Manual</option>
          </select></div>
        <div className="campo"><label htmlFor="m-registro">Registro</label>
          <select id="m-registro" className="selector" value={filtros.registro} onChange={cambiar('registro')}>
            <option value="">Todos</option><option value="AUTOMATICO">Automático</option><option value="CONTINGENCIA">Contingencia</option><option value="DERIVACION">Derivación</option>
          </select></div>
        <div className="campo"><label htmlFor="m-desde">Desde</label>
          <input id="m-desde" type="date" value={filtros.desde} onChange={cambiar('desde')} /></div>
        <div className="campo"><label htmlFor="m-hasta">Hasta</label>
          <input id="m-hasta" type="date" value={filtros.hasta} onChange={cambiar('hasta')} /></div>
        <button type="submit" className="boton boton-primario" disabled={rangoInvalido}>Filtrar</button>
        <button type="button" className="boton" onClick={() => { setFiltros(VACIO); setNumero(1); setAplicados(VACIO); }}>Limpiar</button>
        <button type="button" className="boton" onClick={exportar} disabled={exportando || !pagina?.total}>
          {exportando ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </form>
      {rangoInvalido && <p className="alerta" role="alert">La fecha «Desde» no puede ser posterior a «Hasta».</p>}
      {error && <p className="alerta" role="alert">{error}</p>}

      {pagina && pagina.total === 0 && <p className="ayuda">No hay eventos para los filtros seleccionados.</p>}
      {pagina && pagina.total > 0 && (
        <div className="tabla-desplazable">
          <table className="tabla">
            <thead><tr><th>Fecha y hora</th><th>Tipo</th><th>Resultado</th><th>Registro</th><th>Distancia</th><th>Latencia</th><th>Bicicleta</th><th>Cód. univ.</th><th>Operador</th></tr></thead>
            <tbody>
              {pagina.elementos.map((e) => (
                <tr key={e.idAuditoria}>
                  <td>{fechaPeru(e.fechaUtc)}</td><td>{e.tipoEvento}</td><td>{e.resultado}</td>
                  <td>{REGISTRO[e.registro]}{e.folio ? ` · Folio ${e.folio}` : ''}</td>
                  <td>{e.distanciaEuclidiana == null ? '—' : e.distanciaEuclidiana.toFixed(2)}</td>
                  <td>{e.latenciaMs == null ? '—' : `${e.latenciaMs} ms`}</td>
                  <td>{e.bicicleta}</td><td>{e.codigoUniversitario}</td><td>{e.operador}</td>
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
