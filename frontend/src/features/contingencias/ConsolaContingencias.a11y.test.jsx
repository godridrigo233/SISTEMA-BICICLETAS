import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAxe } from 'vitest-axe';
import ConsolaContingencias from './ConsolaContingencias';
import * as servicio from '../../services/contingenciasService';

vi.mock('../../services/contingenciasService', () => ({
  previsualizarCsv: vi.fn(),
  importarCsv: vi.fn(),
  previsualizarFila: vi.fn(),
  registrarFila: vi.fn(),
  listarPendientes: vi.fn(),
  listarVigilantes: vi.fn(),
  obtenerDetalle: vi.fn(),
  conciliar: vi.fn(),
  conciliarLote: vi.fn(),
  revisar: vi.fn(),
}));

// Se desactiva únicamente la regla color-contrast porque jsdom no calcula estilos y daría falsos resultados.
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

const pendientesEjemplo = [
  {
    idContingencia: 'c1',
    folio: 'E-0031',
    origen: 'CSV',
    tipo: 'INGRESO',
    estudiante: 'ALUMNO UNO',
    bicicleta: 'Trek / Rojo',
    horaManualUtc: '2026-10-17T15:15:00Z',
    estado: 'PENDIENTE',
    motivo: null,
  },
  {
    idContingencia: 'c2',
    folio: 'B-0009',
    origen: 'MANUAL',
    tipo: 'RETIRO',
    estudiante: 'ALUMNO DOS',
    bicicleta: 'GW / Azul',
    horaManualUtc: '2026-10-17T16:00:00Z',
    estado: 'OBSERVADO',
    motivo: 'DNI no coincide con el titular',
  },
];

describe('W3 · Consola de Regularización (Accesibilidad)', () => {
  beforeEach(() => {
    vi.mocked(servicio.listarPendientes).mockResolvedValue(pendientesEjemplo);
    vi.mocked(servicio.listarVigilantes).mockResolvedValue(['vig@ucsm.edu.pe']);
  });

  it('no presenta violaciones de accesibilidad con axe con datos cargados', async () => {
    const { container } = render(<ConsolaContingencias />);
    await screen.findByText('ALUMNO UNO');
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
