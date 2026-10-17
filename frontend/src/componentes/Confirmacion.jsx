/** Diálogo de confirmación para acciones que cambian estados (Nielsen H5: prevención de errores). */
export default function Confirmacion({ titulo, children, textoConfirmar = 'Confirmar', ocupado = false, alConfirmar, alCancelar }) {
  return (
    <div className="modal-fondo">
      <section className="ficha modal" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacion">
        <h2 id="titulo-confirmacion">{titulo}</h2>
        {children}
        <div className="con-boton">
          <button type="button" className="boton" onClick={alCancelar} disabled={ocupado}>Cancelar</button>
          <button type="button" className="boton boton-primario" onClick={alConfirmar} disabled={ocupado}>
            {ocupado ? 'Procesando…' : textoConfirmar}
          </button>
        </div>
      </section>
    </div>
  );
}
