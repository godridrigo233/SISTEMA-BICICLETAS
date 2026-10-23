import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConsolaContingencias from './ConsolaContingencias';
import * as servicio from '../../services/contingenciasService';

vi.mock('../../services/contingenciasService', () => ({
  previsualizarCsv: vi.fn(), importarCsv: vi.fn(), previsualizarFila: vi.fn(), registrarFila: vi.fn(),
  listarPendientes: vi.fn(), listarVigilantes: vi.fn(), obtenerDetalle: vi.fn(), conciliar: vi.fn(), conciliarLote: vi.fn(), revisar: vi.fn(),
}));

const pendientes = [
  { idContingencia: 'c1', folio: 'E-0031', origen: 'CSV', tipo: 'INGRESO', estudiante: 'ALUMNO UNO', bicicleta: 'Trek / Rojo', horaManualUtc: '2026-10-17T15:15:00Z', estado: 'PENDIENTE', motivo: null },
  { idContingencia: 'c2', folio: 'B-0009', origen: 'MANUAL', tipo: 'RETIRO', estudiante: 'ALUMNO DOS', bicicleta: 'GW / Azul', horaManualUtc: '2026-10-17T16:00:00Z', estado: 'OBSERVADO', motivo: 'DNI no coincide con el titular' },
];

describe('W3 · Consola de Regularización', () => {
  beforeEach(() => {
    vi.mocked(servicio.listarPendientes).mockResolvedValue(pendientes);
    vi.mocked(servicio.listarVigilantes).mockResolvedValue(['vig@ucsm.edu.pe']);
  });
  afterEach(() => vi.clearAllMocks());

  const CSV = 'folio;fecha_hora;tipo;codigo;dni;vigilante\nE-1;17/10/2026 10:15;INGRESO;qr;;v@ucsm.edu.pe\nE-2;17/10/2026 10:20;RETIRO;qr2;4512780;v@ucsm.edu.pe\n';
  const filaLista = { fila: 2, folio: 'E-1', tipo: 'INGRESO', codigo: 'qr', bicicleta: 'ALUMNO UNO — Trek / Rojo', fechaHoraUtc: '2026-10-17T15:15:00Z', dni: null, valida: true, error: null };
  const filaError = { fila: 3, folio: 'E-2', tipo: 'RETIRO', codigo: 'qr2', bicicleta: null, fechaHoraUtc: '2026-10-17T15:20:00Z', dni: '4512780', valida: false, error: 'El DNI debe tener 8 dígitos.' };

  it('valida el CSV al elegirlo, sin botón «Validar», y muestra la vista previa autocompletada', async () => {
    vi.mocked(servicio.previsualizarCsv).mockResolvedValue([filaLista, filaError]);
    const usuario = userEvent.setup();
    render(<ConsolaContingencias />);
    expect(screen.queryByRole('button', { name: 'Validar archivo' })).not.toBeInTheDocument();

    await usuario.upload(screen.getByLabelText(/Archivo CSV/), new File([CSV], 'contingencia.csv', { type: 'text/csv' }));

    expect(await screen.findByText('✗ El DNI debe tener 8 dígitos.')).toBeInTheDocument();
    expect(servicio.previsualizarCsv).toHaveBeenCalledWith(expect.stringContaining('E-2;17/10/2026 10:20;RETIRO;qr2;4512780'));
    expect(screen.getByText('1 listas · 1 con error')).toBeInTheDocument();
  });

  it('corrige la fila con error en la misma vista previa y la vuelve a validar', async () => {
    vi.mocked(servicio.previsualizarCsv)
      .mockResolvedValueOnce([filaLista, filaError])
      .mockResolvedValue([filaLista, { ...filaError, dni: '45127809', bicicleta: 'ALUMNO DOS — GW / Azul', valida: true, error: null }]);
    const usuario = userEvent.setup();
    render(<ConsolaContingencias />);
    await usuario.upload(screen.getByLabelText(/Archivo CSV/), new File([CSV], 'contingencia.csv', { type: 'text/csv' }));

    const dni = await screen.findByLabelText('DNI de la fila 3');
    await usuario.clear(dni);
    await usuario.type(dni, '45127809');

    expect(await screen.findByText('2 listas · 0 con error', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(servicio.previsualizarCsv).toHaveBeenLastCalledWith(expect.stringContaining('E-2;17/10/2026 10:20;RETIRO;qr2;45127809'));
    expect(screen.queryByLabelText('DNI de la fila 3')).not.toBeInTheDocument();
  });

  it('«Importar y conciliar» pide una sola confirmación, importa y concilia el lote', async () => {
    vi.mocked(servicio.previsualizarCsv).mockResolvedValue([filaLista, filaError]);
    vi.mocked(servicio.importarCsv).mockResolvedValue({ insertadas: 1, conError: 1, filas: [] });
    vi.mocked(servicio.conciliarLote).mockResolvedValue({ conciliados: 2, observados: 0, conflictos: 0, detalle: [] });
    const usuario = userEvent.setup();
    render(<ConsolaContingencias />);
    await usuario.upload(screen.getByLabelText(/Archivo CSV/), new File([CSV], 'contingencia.csv', { type: 'text/csv' }));

    await usuario.click(await screen.findByRole('button', { name: 'Importar y conciliar 1 filas' }));
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('¿Importar y conciliar 1 movimientos?');
    expect(dialogo).toHaveTextContent('1 filas con error no se cargarán');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));

    expect(servicio.importarCsv).toHaveBeenCalledWith(expect.stringContaining('folio;fecha_hora'));
    expect(servicio.conciliarLote).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Se importaron 1 filas y se procesó el lote: 2 CONCILIADO · 0 OBSERVADO · 0 conflictos\. 1 filas con error no se cargaron/)).toBeInTheDocument();
  });

  it('si la conciliación falla tras importar, lo informa y deja las filas en el lote', async () => {
    vi.mocked(servicio.previsualizarCsv).mockResolvedValue([filaLista]);
    vi.mocked(servicio.importarCsv).mockResolvedValue({ insertadas: 1, conError: 0, filas: [] });
    vi.mocked(servicio.conciliarLote).mockRejectedValue(new Error('caída'));
    const usuario = userEvent.setup();
    render(<ConsolaContingencias />);
    await usuario.upload(screen.getByLabelText(/Archivo CSV/), new File([CSV], 'contingencia.csv', { type: 'text/csv' }));
    await usuario.click(await screen.findByRole('button', { name: 'Importar y conciliar 1 filas' }));
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText(/Se importaron 1 filas, pero no se pudo conciliar el lote/)).toBeInTheDocument();
  });

  it('un archivo con otro encabezado se envía tal cual para que el servidor explique el error', async () => {
    vi.mocked(servicio.previsualizarCsv).mockRejectedValue(new Error('Encabezado no válido'));
    const usuario = userEvent.setup();
    render(<ConsolaContingencias />);
    await usuario.upload(screen.getByLabelText(/Archivo CSV/), new File(['fecha;folio\n1;2\n'], 'otro.csv', { type: 'text/csv' }));
    expect(servicio.previsualizarCsv).toHaveBeenCalledWith('fecha;folio\n1;2\n');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('el bloque 2 se presenta como «Agregar o corregir un movimiento» y explica cuándo usarlo', () => {
    render(<ConsolaContingencias />);
    expect(screen.getByRole('heading', { name: '2. Agregar o corregir un movimiento' })).toBeInTheDocument();
    expect(screen.getByText(/Para filas rechazadas del CSV, la bitácora en papel o casos puntuales/)).toBeInTheDocument();
  });

  it('el registro manual se habilita solo cuando la verificación del servidor es válida', async () => {
    vi.mocked(servicio.previsualizarFila).mockResolvedValue({ valida: true, bicicleta: 'ALUMNO UNO — Trek / Rojo', estadoBicicleta: 'FUERA' });
    vi.mocked(servicio.registrarFila).mockResolvedValue({});
    const usuario = userEvent.setup();
    render(<ConsolaContingencias />);
    const agregar = screen.getByRole('button', { name: 'Agregar al lote' });
    expect(agregar).toBeDisabled();

    await usuario.type(screen.getByLabelText(/Código QR o N.º de marco/), 'SEED-MARCO-0001');
    await usuario.type(screen.getByLabelText(/Folio de bitácora/), 'B-0012');
    await usuario.type(screen.getByLabelText(/Fecha y hora del movimiento/), '2026-10-17T10:15');
    expect(await screen.findByText(/Verificación: ALUMNO UNO — Trek \/ Rojo — Estado actual: FUERA/)).toBeInTheDocument();
    expect(agregar).toBeEnabled();
    await usuario.click(agregar);
    expect(servicio.registrarFila).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'SEED-MARCO-0001', folio: 'B-0012', dni: null }));
  });

  it('conciliar lote pide confirmación y muestra el resumen; OBSERVADO ofrece «Revisar»', async () => {
    vi.mocked(servicio.conciliarLote).mockResolvedValue({ conciliados: 1, observados: 1, conflictos: 0, detalle: [] });
    const usuario = userEvent.setup();
    render(<ConsolaContingencias />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByRole('button', { name: 'Revisar' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Conciliar lote (orden cronológico)' }));
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('¿Conciliar los 1 movimientos pendientes?');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText(/Lote procesado: 1 CONCILIADO · 1 OBSERVADO · 0 conflictos/)).toBeInTheDocument();
  });

  it('«Revisar» exige resolución, DNI corregido y motivo antes de guardar', async () => {
    vi.mocked(servicio.obtenerDetalle).mockResolvedValue({ folio: 'B-0009', dniAnotado: '45127809', dniTitularParcial: '4512 ****', titular: 'ALUMNO DOS', correoTitular: 'a2@estudiante.ucsm.edu.pe', bicicleta: 'GW / Azul', numeroMarco: 'M-2', horaManualUtc: '2026-10-17T16:00:00Z', vigilante: null });
    vi.mocked(servicio.revisar).mockResolvedValue({ folio: 'B-0009', tipo: 'RETIRO', resultado: 'CONCILIADO' });
    const usuario = userEvent.setup();
    render(<ConsolaContingencias />);
    await usuario.click(await screen.findByRole('button', { name: 'Revisar' }));
    expect(await screen.findByText('4512 ****')).toBeInTheDocument();
    const guardar = screen.getByRole('button', { name: 'Guardar resolución' });

    await usuario.click(screen.getByLabelText(/Error de digitación/));
    await usuario.type(screen.getByLabelText(/Motivo u observación/), 'Transcripción errada del folio');
    expect(guardar).toBeDisabled();
    await usuario.type(screen.getByLabelText('DNI corregido'), '45127808');
    await usuario.click(guardar);
    expect(servicio.revisar).toHaveBeenCalledWith('c2', { resolucion: 'ERROR_DIGITACION', motivo: 'Transcripción errada del folio', dniCorregido: '45127808' });
    expect(await screen.findByText('Folio B-0009 conciliado.')).toBeInTheDocument();
  });

  it('«Revisar» ofrece motivos frecuentes que completan el motivo con un clic', async () => {
    vi.mocked(servicio.obtenerDetalle).mockResolvedValue({ folio: 'B-0009', dniAnotado: '45127809', dniTitularParcial: '4512 ****', titular: 'ALUMNO DOS', correoTitular: 'a2@estudiante.ucsm.edu.pe', bicicleta: 'GW / Azul', numeroMarco: 'M-2', horaManualUtc: '2026-10-17T16:00:00Z', vigilante: 'v@ucsm.edu.pe' });
    vi.mocked(servicio.revisar).mockResolvedValue({ folio: 'B-0009', tipo: 'RETIRO', resultado: 'CONCILIADO' });
    const usuario = userEvent.setup();
    render(<ConsolaContingencias />);
    await usuario.click(await screen.findByRole('button', { name: 'Revisar' }));
    await screen.findByText('4512 ****');
    await usuario.click(screen.getByLabelText(/Confirmado por el titular/));
    await usuario.click(screen.getByRole('button', { name: 'Titular confirmó el retiro por teléfono' }));
    expect(screen.getByLabelText(/Motivo u observación/)).toHaveValue('Titular confirmó el retiro por teléfono');
    await usuario.click(screen.getByRole('button', { name: 'Guardar resolución' }));
    expect(servicio.revisar).toHaveBeenCalledWith('c2', { resolucion: 'CONFIRMADO_TITULAR', motivo: 'Titular confirmó el retiro por teléfono', dniCorregido: null });
  });
});
