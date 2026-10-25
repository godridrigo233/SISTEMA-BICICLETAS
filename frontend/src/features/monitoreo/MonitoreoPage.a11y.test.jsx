import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAxe } from 'vitest-axe';
import MonitoreoPage from './MonitoreoPage';
import { consultarEventos, obtenerAlertasBiometricas, obtenerResumen } from '../../services/monitoreoService';

vi.mock('../../services/monitoreoService', () => ({
  obtenerResumen: vi.fn(),
  consultarEventos: vi.fn(),
  exportarCsv: vi.fn(),
  obtenerAlertasBiometricas: vi.fn(),
}));

// Se desactiva únicamente la regla color-contrast porque jsdom no calcula estilos y daría falsos resultados.
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

const resumenEjemplo = {
  bicicletasDentro: 12,
  ingresosHoy: 30,
  retirosHoy: 18,
  rechazosHoy: 2,
  movimientosManualesHoy: 3,
  contingenciasPendientes: 1,
  alertasRevisionBiometrica: 1,
  latenciaPromedioMsHoy: 1450,
};

const eventosEjemplo = {
  total: 1,
  numeroPagina: 1,
  tamanoPagina: 20,
  elementos: [
    {
      idAuditoria: 9,
      fechaUtc: '2026-10-17T15:00:00Z',
      tipoEvento: 'INGRESO',
      resultado: 'MANUAL',
      registro: 'CONTINGENCIA',
      folio: 'F-0012',
      distanciaEuclidiana: null,
      latenciaMs: null,
      bicicleta: 'Trek (Azul)',
      codigoUniversitario: '2020123456',
      operador: 'sup@ucsm.edu.pe',
    },
  ],
};

const alertasEjemplo = [
  {
    codigoUniversitario: '2020123456',
    estudiante: 'JUAN PEREZ',
    rechazosConsecutivos: 3,
    ultimoIntentoUtc: '2026-10-17T15:00:00Z',
  },
];

describe('W6 · Monitoreo y Reportes (Accesibilidad)', () => {
  beforeEach(() => {
    vi.mocked(obtenerResumen).mockResolvedValue(resumenEjemplo);
    vi.mocked(consultarEventos).mockResolvedValue(eventosEjemplo);
    vi.mocked(obtenerAlertasBiometricas).mockResolvedValue(alertasEjemplo);
  });

  it('no presenta violaciones de accesibilidad con axe con datos cargados', async () => {
    const { container } = render(<MonitoreoPage />);
    await screen.findByText('Monitoreo y Reportes');
    await screen.findByText('Movimientos manuales hoy');
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
