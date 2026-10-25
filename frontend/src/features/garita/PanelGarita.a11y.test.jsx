import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAxe } from 'vitest-axe';
import PanelGarita from './PanelGarita';
import { SesionProvider } from '../auth/SesionContext';
import { consultarPorQr, registrarIngreso } from '../../services/garitaService';

vi.mock('../../services/garitaService', () => ({
  consultarPorQr: vi.fn(),
  registrarIngreso: vi.fn(),
  autorizarRetiro: vi.fn(),
}));

vi.mock('../../biometria/extractorFacial', () => ({
  prepararBiometria: vi.fn().mockResolvedValue({}),
  sinAceleracionGrafica: vi.fn().mockReturnValue(false),
  obtenerFaceApi: vi.fn().mockResolvedValue({}),
  cargarModelos: vi.fn().mockResolvedValue([]),
  extraerDescriptor: vi.fn(),
}));

// Se desactiva únicamente la regla color-contrast porque jsdom no calcula estilos y daría falsos resultados.
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

function montar() {
  return render(
    <SesionProvider>
      <PanelGarita />
    </SesionProvider>,
  );
}

describe('W2 · Panel de Garita (Accesibilidad)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(consultarPorQr).mockReset();
    vi.mocked(registrarIngreso).mockReset();
  });

  it('no presenta violaciones de accesibilidad con axe en estado inicial (sin cámara activa)', async () => {
    const { container } = montar();
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });

  it('no presenta violaciones de accesibilidad al mostrar una bicicleta identificada (FUERA)', async () => {
    vi.mocked(consultarPorQr).mockResolvedValue({
      idBicicleta: 'b-001',
      titular: 'JUAN PÉREZ RAMOS',
      codigoUniversitario: '2020123456',
      estado: 'FUERA',
      marcaModelo: 'Trek Marlin 5',
      color: 'Rojo',
      numeroMarco: 'SEED-MARCO-0001',
      rasgosDistintivos: 'Parrilla trasera',
    });
    const { container } = montar();
    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText(/Código QR de la bicicleta/), 'b0000000-0000-4000-8000-0000000000a1{Enter}');
    await screen.findByText(/JUAN PÉREZ RAMOS/);

    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
