import { useCallback, useEffect, useState } from 'react';
import Paginador from '../../componentes/Paginador';
import { fechaPeru } from '../../componentes/formato';
import { mensajeDeError } from '../../services/apiClient';
import { consultarHistorial, obtenerPerfil } from '../../services/estudianteService';
import { descargarSticker, nombreAbreviado, qrComoDataUrl } from '../enrolamiento/sticker';

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
  const [qr, setQr] = useState(null);

  const cargar = useCallback(async () => {
    setError('');
    try {
      setPagina(await consultarHistorial({ ...aplicados, pagina: numero, tamano: 10 }));
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo cargar el historial.'));
    }
  }, [aplicados, numero]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { obtenerPerfil().then(setPerfil).catch(() => setPerfil(null)); }, []);

  const rangoInvalido = filtros.desde && filtros.hasta && filtros.desde > filtros.hasta;
  const bici = perfil?.bicicletas?.[0];
  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  function aplicar(evento) {
    evento.preventDefault();
    if (rangoInvalido) return;
    setNumero(1);
    setAplicados(filtros);
  }

  async function verQr() {
    setQr(await qrComoDataUrl(bici.codigoQr));
  }

  return (
    <main className="contenido garita">
      <div className="con-boton encabezado">
        <h1>Mi historial de movimientos</h1>
        {bici && <button type="button" className="boton" onClick={verQr}>Ver mi QR</button>}
      </div>
      {perfil && !bici && <p className="aviso">Aún no registras una bicicleta. Ve a «Mi registro» para obtener tu QR.</p>}
      {bici && <p className="ayuda">Bicicleta: {bici.marcaModelo} ({bici.color}) · Estado actual: <strong>{bici.estado}</strong></p>}

      <form className="filtros" onSubmit={aplicar} aria-label="Filtros del historial">
        <div className="campo"><label htmlFor="f-tipo">Tipo</label>
          <select id="f-tipo" className="selector" value={filtros.tipo} onChange={cambiar('tipo')}>
            <option value="">Todos</option><option value="INGRESO">Ingreso</option><option value="RETIRO">Retiro</option>
          </select></div>
        <div className="campo"><label htmlFor="f-desde">Desde</label>
          <input id="f-desde" type="date" value={filtros.desde} onChange={cambiar('desde')} /></div>
        <div className="campo"><label htmlFor="f-hasta">Hasta</label>
          <input id="f-hasta" type="date" value={filtros.hasta} onChange={cambiar('hasta')} /></div>
        <button type="submit" className="boton boton-primario" disabled={rangoInvalido}>Filtrar</button>
        <button type="button" className="boton" onClick={() => { setFiltros(VACIO); setNumero(1); setAplicados(VACIO); }}>Limpiar</button>
      </form>
      {rangoInvalido && <p className="alerta" role="alert">La fecha «Desde» no puede ser posterior a «Hasta».</p>}
      {error && <p className="alerta" role="alert">{error}</p>}

      {pagina && pagina.total === 0 && <p className="ayuda">No hay movimientos para los filtros seleccionados.</p>}
      {pagina && pagina.total > 0 && (
        <table className="tabla">
          <thead><tr><th>Fecha y hora</th><th>Tipo</th><th>Resultado</th><th>Registro</th><th>Bicicleta</th></tr></thead>
          <tbody>
            {pagina.elementos.map((m) => (
              <tr key={`${m.fechaUtc}-${m.tipoEvento}-${m.resultado}`}>
                <td>{fechaPeru(m.fechaUtc)}</td><td>{m.tipoEvento}</td><td>{ETIQUETA[m.resultado]}</td>
                <td>{m.registro === 'MANUAL' ? 'Manual' : 'Automático'}</td><td>{m.bicicleta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Paginador pagina={pagina} alCambiar={setNumero} />

      {qr && (
        <div className="modal-fondo">
          <section className="ficha modal" role="dialog" aria-modal="true" aria-labelledby="titulo-qr">
            <h2 id="titulo-qr">Mi código QR</h2>
            <img src={qr} alt="Código QR de mi bicicleta" width="220" height="220" />
            <p className="ayuda">Muéstralo en garita si el sticker está dañado.</p>
            <div className="con-boton">
              <button type="button" className="boton boton-primario"
                onClick={() => descargarSticker(bici.codigoQr, nombreAbreviado(perfil.nombres, perfil.apellidos))}>Descargar sticker QR</button>
              <button type="button" className="boton" onClick={() => setQr(null)}>Cerrar</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
