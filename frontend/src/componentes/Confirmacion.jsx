import { AlertTriangle, HelpCircle } from 'lucide-react';

/** Diálogo de confirmación para acciones que cambian estados (Nielsen H5: prevención de errores). */
export default function Confirmacion({ titulo, children, textoConfirmar = 'Confirmar', ocupado = false, alConfirmar, alCancelar }) {
  const esPeligro = textoConfirmar === 'Inactivar' || textoConfirmar.toLowerCase().includes('inactivar') || textoConfirmar.toLowerCase().includes('eliminar');

  return (
    <div className="modal-fondo">
      <section className="ficha modal" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacion" style={{ padding: 28, textAlign: 'center' }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: esPeligro ? 'var(--rojo-fondo)' : 'var(--verde-claro)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 16px',
          }}
        >
          {esPeligro ? (
            <AlertTriangle size={26} aria-hidden="true" style={{ color: 'var(--rojo-error)' }} />
          ) : (
            <HelpCircle size={26} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
          )}
        </div>

        <h2 id="titulo-confirmacion" style={{ justifyContent: 'center', fontSize: '1.25rem', marginBottom: 12 }}>
          {titulo}
        </h2>

        <div style={{ color: 'var(--gris-700)', fontSize: '0.95rem', lineHeight: 1.5, margin: '12px 0 20px' }}>
          {children}
        </div>

        <div className="con-boton" style={{ justifyContent: 'center', gap: 12 }}>
          <button type="button" className="boton" onClick={alCancelar} disabled={ocupado}>
            Cancelar
          </button>
          <button
            type="button"
            className={`boton ${esPeligro ? 'boton-peligro' : 'boton-primario'}`}
            style={esPeligro ? { background: 'var(--rojo-error)', color: '#ffffff', borderColor: 'var(--rojo-error)' } : {}}
            onClick={alConfirmar}
            disabled={ocupado}
          >
            {ocupado ? 'Procesando…' : textoConfirmar}
          </button>
        </div>
      </section>
    </div>
  );
}
