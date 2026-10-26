import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MonitoreoPage from './MonitoreoPage';
import { consultarEventos, exportarCsv, obtenerAlertasBiometricas, obtenerResumen } from '../../services/monitoreoService';

vi.mock('../../services/monitoreoService', () => ({ obtenerResumen: vi.fn(), consultarEventos: vi.fn(), exportarCsv: vi.fn(), obtenerAlertasBiometricas: vi.fn() }));

describe('W6 · Monitoreo y Reportes', () => {
  beforeEach(() => {
    vi.mocked(obtenerAlertasBiometricas).mockResolvedValue([]);
    vi.mocked(obtenerResumen).mockResolvedValue({ bicicletasDentro: 12, ingresosHoy: 30, retirosHoy: 18, rechazosHoy: 2, movimientosManualesHoy: 3, contingenciasPendientes: 1, latenciaPromedioMsHoy: 1450 });
    vi.mocked(consultarEventos).mockResolvedValue({
      total: 1, numeroPagina: 1, tamanoPagina: 20,
      elementos: [{ idAuditoria: 9, fechaUtc: '2026-10-17T15:00:00Z', tipoEvento: 'INGRESO', resultado: 'MANUAL', registro: 'CONTINGENCIA', folio: 'F-0012', distanciaEuclidiana: null, latenciaMs: null, bicicleta: 'Trek (Azul)', codigoUniversitario: '2020123456', operador: 'sup@ucsm.edu.pe' }],
    });
  });
  afterEach(() => vi.clearAllMocks());

  it('muestra los KPI del día y la columna Registro con el folio', async () => {
    render(<MonitoreoPage />);
    expect(await screen.findByText('Movimientos manuales hoy')).toBeInTheDocument();
    expect(screen.getByText('1.45 s')).toBeInTheDocument();
    expect(screen.getByText('Folio F-0012')).toBeInTheDocument();
  });

  it('usa términos del usuario e indica la hora de la última actualización (Nielsen H1 y H2)', async () => {
    render(<MonitoreoPage />);
    expect(await screen.findByText('Tiempo promedio de verificación hoy')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Diferencia facial' })).toBeInTheDocument();
    expect(screen.getByText(/^Actualizado a las \d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('«Ver movimientos manuales» filtra por resultado MANUAL y exporta con los filtros aplicados', async () => {
    const usuario = userEvent.setup();
    render(<MonitoreoPage />);
    await usuario.click(await screen.findByRole('button', { name: 'Ver movimientos manuales' }));
    expect(consultarEventos).toHaveBeenLastCalledWith(expect.objectContaining({ resultado: 'MANUAL', pagina: 1 }));
    await usuario.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(exportarCsv).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'MANUAL' }));
  });

  it('muestra las alertas de revisión biométrica (3 rechazos consecutivos)', async () => {
    vi.mocked(obtenerAlertasBiometricas).mockResolvedValue([
      { codigoUniversitario: '2020123456', estudiante: 'JUAN PEREZ', rechazosConsecutivos: 3, ultimoIntentoUtc: '2026-10-17T15:00:00Z' },
    ]);
    render(<MonitoreoPage />);
    const seccion = await screen.findByRole('region', { name: 'Alertas de revisión biométrica' });
    expect(seccion).toHaveTextContent('JUAN PEREZ');
    expect(seccion).toHaveTextContent('2020123456');
  });
});
