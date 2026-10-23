import { describe, expect, it } from 'vitest';
import { armarCsv, leerCsv } from './csvGarita';

describe('csvGarita', () => {
  it('lee el CSV de la plantilla con «;», BOM y filas vacías', () => {
    const { encabezadoValido, filas } = leerCsv('\uFEFFfolio;fecha_hora;tipo;codigo;dni;vigilante\r\nE-1;17/10/2026 10:15;INGRESO;abc;;v@ucsm.edu.pe\r\n;;;;;\r\nE-2;17/10/2026 11:00;RETIRO;def;4512780;v@ucsm.edu.pe\r\n');
    expect(encabezadoValido).toBe(true);
    expect(filas).toHaveLength(2);
    expect(filas[1]).toEqual({ folio: 'E-2', fecha_hora: '17/10/2026 11:00', tipo: 'RETIRO', codigo: 'def', dni: '4512780', vigilante: 'v@ucsm.edu.pe' });
  });

  it('acepta «,» y comillas, y detecta un encabezado distinto al de la plantilla', () => {
    expect(leerCsv('"folio","fecha_hora","tipo","codigo","dni","vigilante"\n"E-1","x","INGRESO","c","",""').filas[0].folio).toBe('E-1');
    expect(leerCsv('fecha;folio\n1;2').encabezadoValido).toBe(false);
    expect(leerCsv('').filas).toEqual([]);
  });

  it('vuelve a armar el CSV sin filas vacías, con la fila k en la línea k + 2', () => {
    const csv = armarCsv([{ folio: 'E-1', fecha_hora: '17/10/2026 10:15', tipo: 'INGRESO', codigo: 'abc', dni: '', vigilante: 'a;b' }]);
    expect(csv).toBe('folio;fecha_hora;tipo;codigo;dni;vigilante\nE-1;17/10/2026 10:15;INGRESO;abc;;a,b\n');
    expect(leerCsv(csv).filas[0].codigo).toBe('abc');
  });
});
