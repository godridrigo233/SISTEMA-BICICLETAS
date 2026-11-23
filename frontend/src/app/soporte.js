/**
 * Canal de soporte del sistema (Práctica 11, plan de mantenimiento y soporte; ITIL 4, gestión de incidentes).
 * El primer nivel es el Supervisor de turno de la garita; el canal escrito es la Dirección de Seguridad Institucional.
 */
export const CORREO_SOPORTE = 'oficina.seguridad@ucsm.edu.pe';

const fechaLima = (fecha) => new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short',
}).format(fecha);

/**
 * Enlace mailto con el reporte ya estructurado (rol, pantalla, fecha y hora), para que la incidencia llegue
 * con los datos que el Supervisor necesita para registrarla y clasificarla.
 */
export function enlaceSoporte({ rol = 'Sin sesión', pantalla = '—', fecha = new Date() } = {}) {
  const asunto = `[Control de Bicicletas] Incidencia - ${rol}`;
  const cuerpo = [
    `Rol: ${rol}`,
    `Pantalla: ${pantalla}`,
    `Fecha y hora: ${fechaLima(fecha)}`,
    '',
    'Qué ocurrió:',
    '',
    '¿La garita pudo seguir operando? (Sí / No, se aplicó la contingencia)',
  ].join('\n');
  return `mailto:${CORREO_SOPORTE}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}
