/** Paginación común a W5 y W6 (Nielsen H4: mismo patrón en todo el sistema). */
export default function Paginador({ pagina, alCambiar }) {
  if (!pagina || pagina.total === 0) return null;
  const paginas = Math.max(1, Math.ceil(pagina.total / pagina.tamanoPagina));
  const actual = pagina.numeroPagina;

  return (
    <nav className="con-boton paginador" aria-label="Paginación">
      <button
        type="button"
        className="boton"
        disabled={actual <= 1}
        onClick={() => alCambiar(actual - 1)}
        style={{ padding: '6px 14px', minHeight: 38 }}
      >
        ‹ Anterior
      </button>
      <span style={{ fontVariantNumeric: 'tabular-nums', padding: '0 8px' }}>
        Página {actual} de {paginas} · {pagina.total} registros
      </span>
      <button
        type="button"
        className="boton"
        disabled={actual >= paginas}
        onClick={() => alCambiar(actual + 1)}
        style={{ padding: '6px 14px', minHeight: 38 }}
      >
        Siguiente ›
      </button>
    </nav>
  );
}
