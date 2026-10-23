/**
 * Lectura y armado del CSV de la plantilla de la garita en el navegador, para que el Supervisor
 * corrija una fila con error directamente en la vista previa (sin reescribirla en otro formulario).
 * El servidor sigue siendo quien valida: aquí solo se separan y se vuelven a unir las columnas.
 */
export const COLUMNAS = ['folio', 'fecha_hora', 'tipo', 'codigo', 'dni', 'vigilante'];

const limpiar = (celda) => celda.trim().replace(/^"|"$/g, '').trim();

/** Devuelve { encabezadoValido, filas } con las filas no vacías del archivo, en orden. */
export function leerCsv(texto) {
  const lineas = String(texto ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  const separador = lineas[0]?.includes(';') ? ';' : ',';
  const encabezado = (lineas[0] ?? '').split(separador).map((c) => limpiar(c).toLowerCase());
  const encabezadoValido = COLUMNAS.every((c, i) => encabezado[i] === c);
  const filas = lineas
    .slice(1)
    .filter((l) => l.replaceAll(separador, ' ').trim() !== '')
    .map((l) => {
      const celdas = l.split(separador).map(limpiar);
      return Object.fromEntries(COLUMNAS.map((c, i) => [c, celdas[i] ?? '']));
    });
  return { encabezadoValido, filas };
}

/** Une las filas en un CSV con «;». La fila k del arreglo queda como la fila k + 2 del archivo. */
export function armarCsv(filas) {
  const cuerpo = filas.map((f) => COLUMNAS.map((c) => String(f[c] ?? '').replaceAll(';', ',').trim()).join(';'));
  return [COLUMNAS.join(';'), ...cuerpo].join('\n') + '\n';
}
