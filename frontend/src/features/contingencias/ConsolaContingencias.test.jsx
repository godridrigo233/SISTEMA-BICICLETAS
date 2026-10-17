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

  it('valida el CSV, muestra la vista previa autocompletada y agrega solo las filas listas', async () => {
    vi.mocked(servicio.previsualizarCsv).mockResolvedValue([
      { fila: 2, folio: 'E-1', tipo: 'INGRESO', codigo: 'qr', bicicleta: 'ALUMNO UNO — Trek / Rojo', fechaHoraUtc: '2026-10-17T15:15:00Z', dni: null, valida: true, error: null },
      { fila: 3, folio: 'E-2', tipo: 'INGRESO', codigo: 'X', bicicleta: null, fechaHoraUtc: '2026-10-17T15:20:00Z', dni: null, valida: false, error: 'Código no registrado.' },
    ]);
    vi.mocked(servicio.importarCsv).mockResolvedValue({ insertadas: 1, conError: 1, filas: [] });
    const usuario = userEvent.setup();
    render(<ConsolaContingencias />);

    const csv = new File(['folio;fecha_hora;tipo;codigo;dni;vigilante\nE-1;...'], 'contingencia.csv', { type: 'text/csv' });
    await usuario.upload(screen.getByLabelText(/Archivo CSV/), csv);
    await usuario.click(screen.getByRole('button', { name: 'Validar archivo' }));

    expect(await screen.findByText('✗ Código no registrado.')).toBeInTheDocument();
    expect(screen.getByText('1 listas · 1 con error')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Agregar 1 filas al lote' }));
    expect(servicio.importarCsv).toHaveBeenCalledWith(expect.stringContaining('folio;fecha_hora'));
    expect(await screen.findByText(/Se agregaron 1 filas al lote \(1 con error/)).toBeInTheDocument();
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
});
