import { useCallback, useEffect, useState } from 'react';
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
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setPagina(await listarUsuarios({ rol: filtroRol, pagina: numero, tamano: 20 }));
    } catch (e) {
      setMensaje({ tipo: 'alerta', texto: mensajeDeError(e, 'No se pudo cargar la lista de cuentas.') });
    }
  }, [filtroRol, numero]);

  useEffect(() => { cargar(); }, [cargar]);

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
    ejecutar(async () => {
      setTemporal(await crearUsuario(correo.trim(), Number(rol)));
      setCorreo('');
      setRol('');
    }, 'No se pudo crear la cuenta.');
  };

  const restablecer = (u) => ejecutar(async () => setTemporal(await restablecerPassword(u.idUsuario)), 'No se pudo restablecer la contraseña.');

  const alternar = (u) => (u.activo
    ? setInactivar(u)
    : ejecutar(async () => {
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
      <h1>Gestión de Usuarios y Roles</h1>
      {mensaje && <p className={mensaje.tipo} role={mensaje.tipo === 'alerta' ? 'alert' : 'status'}>{mensaje.texto}</p>}

      <form className="ficha filtros" onSubmit={crear} aria-label="Crear cuenta del personal">
        <div className="campo campo-ancho"><label htmlFor="u-correo">Correo institucional *</label>
          <input id="u-correo" type="email" maxLength={100} value={correo} placeholder="usuario@ucsm.edu.pe" onChange={(e) => setCorreo(e.target.value)} /></div>
        <div className="campo"><label htmlFor="u-rol">Rol *</label>
          <select id="u-rol" className="selector" value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="">Seleccione…</option>
            {ROLES.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select></div>
        <button type="submit" className="boton boton-primario" disabled={!correoValido || !rol || ocupado}>Crear cuenta</button>
        <p className="ayuda ancho-completo">Cuentas del personal. Los estudiantes provienen del padrón institucional (carga ETL). La contraseña temporal la genera el servidor; en la base de datos solo se guarda su hash (BCrypt).</p>
      </form>

      <section className="ficha" aria-labelledby="t-cuentas">
        <div className="con-boton encabezado">
          <h2 id="t-cuentas">Cuentas registradas</h2>
          <div className="campo"><label htmlFor="u-filtro">Filtrar por rol</label>
            <select id="u-filtro" className="selector" value={filtroRol} onChange={(e) => { setNumero(1); setFiltroRol(e.target.value); }}>
              <option value="">Todos</option><option value="1">Estudiante</option>
              {ROLES.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select></div>
        </div>
        {pagina && (
          <div className="tabla-desplazable">
            <table className="tabla">
              <thead><tr><th>Correo institucional</th><th>Rol</th><th>Creado</th><th>Cuenta activa</th><th>Acción</th></tr></thead>
              <tbody>
                {pagina.elementos.map((u) => (
                  <tr key={u.idUsuario}>
                    <td>{u.correo}</td><td>{u.rol}</td><td>{fecha(u.creadoEnUtc)}</td>
                    <td><label><input type="checkbox" checked={u.activo} disabled={ocupado} onChange={() => alternar(u)}
                      aria-label={`Cuenta ${u.correo} activa`} /> {u.activo ? 'Activa' : 'Inactiva'}</label></td>
                    <td><button type="button" className="boton" disabled={!u.activo || ocupado} onClick={() => restablecer(u)}>Restablecer contraseña</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginador pagina={pagina} alCambiar={setNumero} />
        <p className="ayuda">«Restablecer contraseña» se deshabilita en cuentas inactivas. No existe eliminación física: las cuentas se inactivan (borrado lógico).</p>
      </section>

      {inactivar && (
        <Confirmacion titulo="¿Inactivar esta cuenta?" textoConfirmar="Inactivar" ocupado={ocupado}
          alCancelar={() => setInactivar(null)} alConfirmar={confirmarInactivar}>
          <p>{inactivar.correo}: el usuario no podrá iniciar sesión.{inactivar.idRol === 1 ? ' Se eliminará su descriptor biométrico (Ley N.º 29733); su historial se conserva.' : ''}</p>
        </Confirmacion>
      )}
      {temporal && (
        <div className="modal-fondo">
          <section className="ficha modal" role="dialog" aria-modal="true" aria-labelledby="t-temporal">
            <h2 id="t-temporal">✓ Contraseña temporal generada</h2>
            <p>Cuenta: {temporal.correo} — Rol: {temporal.rol}</p>
            <div className="con-boton">
              <label htmlFor="u-temporal">Contraseña temporal:</label>
              <input id="u-temporal" readOnly value={temporal.passwordTemporal} className="codigo" />
              <button type="button" className="boton" onClick={copiar} aria-label="Copiar contraseña temporal">{copiado ? 'Copiada' : 'Copiar'}</button>
            </div>
            <p>Se muestra <strong>una sola vez</strong>: entréguela al usuario en persona. En su primer ingreso el sistema le pedirá crear una contraseña propia.</p>
            <button type="button" className="boton boton-primario" onClick={() => { setTemporal(null); setCopiado(false); }}>Entendido</button>
          </section>
        </div>
      )}
    </main>
  );
}
