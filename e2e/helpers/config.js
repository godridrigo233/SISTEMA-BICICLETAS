/**
 * Configuración y credenciales para pruebas E2E.
 * IMPORTANTE: Nunca expone credenciales ni secretos en el código;
 * todas se leen de variables de entorno (en local vía process.env o en CI vía GitHub Secrets).
 */

export const config = {
  baseUrl: process.env.E2E_BASE_URL || 'http://localhost:5173',
  usuarios: {
    estudiante: {
      correo: process.env.E2E_ESTUDIANTE_EMAIL || process.env.E2E_ESTUDIANTE_CORREO || '',
      password: process.env.E2E_ESTUDIANTE_PASSWORD || process.env.E2E_ESTUDIANTE_CLAVE || '',
      nombreRol: 'Estudiante',
      rutaInicio: '/estudiante/historial',
    },
    garitero: {
      correo: process.env.E2E_GARITERO_EMAIL || process.env.E2E_GARITERO_CORREO || '',
      password: process.env.E2E_GARITERO_PASSWORD || process.env.E2E_GARITERO_CLAVE || '',
      nombreRol: 'Garitero',
      rutaInicio: '/garita/control-acceso',
    },
    supervisor: {
      correo: process.env.E2E_SUPERVISOR_EMAIL || process.env.E2E_SUPERVISOR_CORREO || '',
      password: process.env.E2E_SUPERVISOR_PASSWORD || process.env.E2E_SUPERVISOR_CLAVE || '',
      nombreRol: 'Supervisor',
      rutaInicio: '/garita/control-acceso',
    },
    administrador: {
      correo: process.env.E2E_ADMIN_EMAIL || process.env.E2E_ADMINISTRADOR_EMAIL || process.env.E2E_ADMIN_CORREO || process.env.E2E_ADMINISTRADOR_CORREO || '',
      password: process.env.E2E_ADMIN_PASSWORD || process.env.E2E_ADMINISTRADOR_PASSWORD || process.env.E2E_ADMIN_CLAVE || process.env.E2E_ADMINISTRADOR_CLAVE || '',
      nombreRol: 'Administrador',
      rutaInicio: '/gestion/monitoreo',
    },
  },
  datosPrueba: {
    // Identificador QR de bicicleta de prueba (por defecto toma el registro sintético S001)
    bicicletaQr: process.env.E2E_BICICLETA_QR || 'b0000000-0000-4000-8000-0000000000a1',
    vigilanteCorreo: process.env.E2E_VIGILANTE_EMAIL || process.env.E2E_GARITERO_EMAIL || 'seed.garita1@ucsm.edu.pe',
  },
};

/**
 * Valida si las credenciales de un rol están configuradas.
 * Si faltan, omite la prueba de manera explícita con un mensaje informativo.
 */
export function omitirSiFaltanCredenciales(test, rolClave) {
  const usuario = config.usuarios[rolClave];
  if (!usuario || !usuario.correo || !usuario.password) {
    test.skip(true, `Credenciales no provistas para el rol «${rolClave}». Configure E2E_${rolClave.toUpperCase()}_EMAIL y E2E_${rolClave.toUpperCase()}_PASSWORD.`);
    return false;
  }
  return true;
}
