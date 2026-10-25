import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAxe } from 'vitest-axe';
import HistorialPage from './HistorialPage';
import { consultarHistorial, obtenerPerfil } from '../../services/estudianteService';

vi.mock('../../services/estudianteService', () => ({
  consultarHistorial: vi.fn(),
  obtenerPerfil: vi.fn(),
}));

vi.mock('../enrolamiento/sticker', () => ({
  qrComoDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,AA'),
  descargarSticker: vi.fn(),
  nombreAbreviado: () => 'J. Pérez R.',
}));

// Se desactiva únicamente la regla color-contrast porque jsdom no calcula estilos y daría falsos resultados.
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

const paginaEjemplo = {
  total: 1,
  numeroPagina: 1,
  tamanoPagina: 10,
  elementos: [
    {
      fechaUtc: '2026-10-17T13:05:00Z',
      tipoEvento: 'RETIRO',
      resultado: 'DENEGADO',
      registro: 'AUTOMATICO',
      bicicleta: 'Trek (Azul)',
    },
  ],
};

const perfilEjemplo = {
  nombres: 'Juan',
  apellidos: 'Pérez Ramos',
  bicicletas: [
    {
      codigoQr: 'qr-1',
      marcaModelo: 'Trek',
      color: 'Azul',
      estado: 'FUERA',
    },
  ],
};

describe('W5 · Historial personal (Accesibilidad)', () => {
  beforeEach(() => {
    vi.mocked(obtenerPerfil).mockResolvedValue(perfilEjemplo);
    vi.mocked(consultarHistorial).mockResolvedValue(paginaEjemplo);
  });

  it('no presenta violaciones de accesibilidad con axe con datos cargados', async () => {
    const { container } = render(<HistorialPage />);
    await screen.findByText('Mi historial de movimientos');
    await screen.findByText('✗ Denegado');
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
