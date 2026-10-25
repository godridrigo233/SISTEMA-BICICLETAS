const FORMATO = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'America/Lima',
});

/** Fecha UTC de la API mostrada en hora de Perú. */
export const fechaPeru = (iso) => FORMATO.format(new Date(iso));

/** Fecha de hoy en Perú en formato AAAA-MM-DD (para los filtros). */
export const hoyPeru = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());

/** «1 fila», «2 filas»: concordancia de número en los mensajes (Nielsen H4). */
export const contar = (n, singular, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;

const HORA = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Lima' });
/** Hora actual de Perú (HH:MM) para indicar cuándo se actualizó un dato. */
export const horaPeru = (fecha = new Date()) => HORA.format(fecha);
