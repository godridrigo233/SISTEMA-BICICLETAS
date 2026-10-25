import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  Copy,
  Filter,
  KeyRound,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import Confirmacion from '../../componentes/Confirmacion';
import Paginador from '../../componentes/Paginador';
import { mensajeDeError } from '../../services/apiClient';
import { cambiarEstado, crearUsuario, listarUsuarios, restablecerPassword } from '../../services/usuariosService';

const CORREO_PERSONAL = /^[^\s@]+@ucsm\.edu\.pe$/i;
const ROLES = [[2, 'Garitero'], [3, 'Supervisor'], [4, 'Administrador']];
const fecha = (iso) => (iso ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima' }).format(new Date(iso)) : '—');

/** W7 · Gestión de Usuarios y Roles (solo Administrador). */
export default function GestionUsuarios() {
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [numero, setNumero] = useState(1);
  const [pagina, setPagina] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [temporal, setTemporal] = useState(null);
  const [inactivar, setInactivar] = useState(null);
  const [restablecerA, setRestablecerA] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setPagina(await listarUsuarios({ rol: filtroRol, pagina: numero, tamano: 20 }));
    } catch (e) {
      setMensaje({ tipo: 'alerta', texto: mensajeDeError(e, 'No se pudo cargar la lista de cuentas.') });
    }
  }, [filtroRol, numero]);

  useEffect(() => { void cargar(); }, [cargar]);

  const correoValido = CORREO_PERSONAL.test(correo.trim());

  async function ejecutar(accion, porDefecto) {
    setOcupado(true);
    setMensaje(null);
    try {
      await accion();
      await cargar();
    } catch (e) {
      setMensaje({ tipo: 'alerta', texto: mensajeDeError(e, porDefecto) });
    } finally {
      setOcupado(false);
    }
  }

  const crear = (e) => {
    e.preventDefault();
    if (!correoValido || !rol) return;
    void ejecutar(async () => {
      setTemporal(await crearUsuario(correo.trim(), Number(rol)));
      setCorreo('');
      setRol('');
    }, 'No se pudo crear la cuenta.');
  };

  // Nielsen H5: restablecer invalida de inmediato la contraseña vigente, por eso se confirma antes.
  async function confirmarRestablecer() {
    const u = restablecerA;
    await ejecutar(async () => setTemporal(await restablecerPassword(u.idUsuario)), 'No se pudo restablecer la contraseña.');
    setRestablecerA(null);
  }

  const alternar = (u) => (u.activo
    ? setInactivar(u)
    : void ejecutar(async () => {
      await cambiarEstado(u.idUsuario, true);
      setMensaje({ tipo: 'exito', texto: `Cuenta ${u.correo} reactivada.` });
    }, 'No se pudo activar la cuenta.'));

  async function confirmarInactivar() {
    const u = inactivar;
    await ejecutar(async () => {
      await cambiarEstado(u.idUsuario, false);
      setMensaje({ tipo: 'exito', texto: `Cuenta ${u.correo} inactivada.` });
    }, 'No se pudo inactivar la cuenta.');
    setInactivar(null);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(temporal.passwordTemporal);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <main className="contenido">
      <div className="con-boton encabezado">
        <div>
          <h1>Gestión de Usuarios y Roles</h1>
          <p className="ayuda" style={{ marginTop: -8 }}>
            Cree las cuentas del personal, asigne su rol y restablezca contraseñas. Cada rol solo ve las pantallas que le corresponden.
          </p>
        </div>
      </div>

      {mensaje && (
        <p className={mensaje.tipo} role={mensaje.tipo === 'alerta' ? 'alert' : 'status'}>
          {mensaje.tipo === 'exito' && <CheckCircle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />}
          {mensaje.tipo === 'alerta' && <XCircle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />}
          <span>{mensaje.texto}</span>
        </p>
      )}

      {/* Formulario de Creación de Personal */}
      <form className="ficha filtros" onSubmit={crear} aria-label="Crear cuenta del personal" style={{ borderLeft: '4px solid var(--verde-ucsm)' }}>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <UserPlus size={20} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
          <h2 style={{ margin: 0, paddingBottom: 0, borderBottom: 'none', fontSize: '1.1rem' }}>
            Registrar nueva cuenta de personal
          </h2>
        </div>

        <div className="campo campo-ancho">
          <label htmlFor="u-correo">Correo institucional *</label>
          <input
            id="u-correo"
            type="email"
            maxLength={100}
            value={correo}
            placeholder="usuario@ucsm.edu.pe"
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="u-rol">Rol *</label>
          <select id="u-rol" className="selector" value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="">Seleccione…</option>
            {ROLES.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>
        </div>
        <button
          type="submit"
          className="boton boton-primario"
          disabled={!correoValido || !rol || ocupado}
          style={{ minHeight: 44 }}
        >
          <UserPlus size={18} aria-hidden="true" />
          Crear cuenta
        </button>
        <p className="ayuda ancho-completo">
          Solo para el personal: las cuentas de los estudiantes provienen del padrón institucional. El sistema genera una contraseña temporal, que se muestra una sola vez y nunca se guarda en texto legible.
        </p>
      </form>

      {/* Cuentas Registradas */}
      <section className="ficha" aria-labelledby="t-cuentas">
        <div className="con-boton encabezado">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} aria-hidden="true" style={{ color: 'var(--gris-700)' }} />
            <h2 id="t-cuentas" style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
              Cuentas registradas
            </h2>
          </div>
          <div className="campo" style={{ margin: 0, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <label htmlFor="u-filtro" style={{ whiteSpace: 'nowrap', margin: 0 }}>Filtrar por rol</label>
            <select
              id="u-filtro"
              className="selector"
              value={filtroRol}
              onChange={(e) => { setNumero(1); setFiltroRol(e.target.value); }}
              style={{ minHeight: 38, padding: '6px 12px' }}
            >
              <option value="">Todos</option>
              <option value="1">Estudiante</option>
              {ROLES.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </div>
        </div>

        {pagina && (
          <div className="tabla-desplazable">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Correo institucional</th>
                  <th>Rol</th>
                  <th>Creado</th>
                  <th>Cuenta activa</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pagina.elementos.map((u) => (
                  <tr key={u.idUsuario}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{u.correo}</span>
                    </td>
                    <td>
                      <span className="etiqueta" style={{ background: 'var(--gris-100)', borderColor: 'var(--gris-200)' }}>
                        {u.rol}
                      </span>
                    </td>
                    <td>{fecha(u.creadoEnUtc)}</td>
                    <td>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={u.activo}
                          disabled={ocupado}
                          onChange={() => alternar(u)}
                          aria-label={`Cuenta ${u.correo} activa`}
                          style={{ width: 18, height: 18 }}
                        />
                        <span className={`etiqueta ${u.activo ? 'badge-exitoso' : 'badge-fuera'}`} style={{ fontSize: '0.8rem', padding: '2px 8px' }}>
                          {u.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </label>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="boton"
                        disabled={!u.activo || ocupado}
                        onClick={() => setRestablecerA(u)}
                        style={{ fontSize: '0.875rem', padding: '6px 14px' }}
                      >
                        <KeyRound size={16} aria-hidden="true" />
                        Restablecer contraseña
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Paginador pagina={pagina} alCambiar={setNumero} />
        <p className="ayuda" style={{ marginTop: 12 }}>
          Para restablecer la contraseña, la cuenta debe estar activa. Las cuentas no se eliminan: se inactivan y conservan su historial.
        </p>
      </section>

      {restablecerA && (
        <Confirmacion
          titulo="¿Restablecer la contraseña?"
          textoConfirmar="Restablecer"
          ocupado={ocupado}
          alCancelar={() => setRestablecerA(null)}
          alConfirmar={confirmarRestablecer}
        >
          <p>
            {restablecerA.correo}: su contraseña actual dejará de funcionar de inmediato y se generará una temporal para entregarle en persona.
          </p>
        </Confirmacion>
      )}

      {/* Modal de confirmación para inactivar cuenta */}
      {inactivar && (
        <Confirmacion
          titulo="¿Inactivar esta cuenta?"
          textoConfirmar="Inactivar"
          ocupado={ocupado}
          alCancelar={() => setInactivar(null)}
          alConfirmar={confirmarInactivar}
        >
          <p>
            {inactivar.correo}: el usuario no podrá iniciar sesión.
            {inactivar.idRol === 1 ? ' Se eliminará su descriptor biométrico (Ley N.º 29733); su historial se conserva.' : ''}
          </p>
        </Confirmacion>
      )}

      {/* Modal destacado para contraseña temporal generada */}
      {temporal && (
        <div className="modal-fondo">
          <section className="ficha modal" role="dialog" aria-modal="true" aria-labelledby="t-temporal" style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--verde-claro)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
              <KeyRound size={28} aria-hidden="true" style={{ color: 'var(--verde-ucsm)' }} />
            </div>
            <h2 id="t-temporal" style={{ justifyContent: 'center' }}>
              ✓ Contraseña temporal generada
            </h2>
            <p className="ayuda" style={{ fontSize: '0.95rem' }}>
              Cuenta: <strong>{temporal.correo}</strong> — Rol: <strong>{temporal.rol}</strong>
            </p>

            <div
              className="con-boton"
              style={{
                background: 'var(--verde-claro)',
                border: '2px dashed var(--verde-borde)',
                borderRadius: 12,
                padding: '16px 20px',
                margin: '16px 0',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <label htmlFor="u-temporal" style={{ fontWeight: 600, color: 'var(--verde-oscuro)', fontSize: '0.9rem' }}>
                Contraseña temporal:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 320 }}>
                <input
                  id="u-temporal"
                  readOnly
                  value={temporal.passwordTemporal}
                  className="codigo"
                  style={{ flex: 1, minHeight: 46, fontSize: '1.25rem', textAlign: 'center', background: '#ffffff' }}
                />
                <button
                  type="button"
                  className="boton boton-primario"
                  onClick={copiar}
                  aria-label="Copiar contraseña temporal"
                  style={{ minWidth: 90 }}
                >
                  {copiado ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                  {copiado ? 'Copiada' : 'Copiar'}
                </button>
              </div>
            </div>

            <p className="ayuda" style={{ color: 'var(--gris-700)', fontSize: '0.9rem' }}>
              Se muestra <strong>una sola vez</strong>: entréguela al usuario en persona. En su primer ingreso el sistema le pedirá crear una contraseña propia.
            </p>

            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                className="boton boton-primario"
                onClick={() => { setTemporal(null); setCopiado(false); }}
                style={{ padding: '10px 32px' }}
              >
                Entendido
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
