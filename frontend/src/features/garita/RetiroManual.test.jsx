import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VerificacionRetiro from './VerificacionRetiro';
import { extraerDescriptor } from '../../biometria/extractorFacial';
import { autorizarRetiro, retiroManual } from '../../services/garitaService';

vi.mock('../../services/garitaService', () => ({ autorizarRetiro: vi.fn(), retiroManual: vi.fn() }));
vi.mock('../../biometria/extractorFacial', () => ({
  obtenerFaceApi: vi.fn().mockResolvedValue({}),
  cargarModelos: vi.fn().mockResolvedValue([]),
  extraerDescriptor: vi.fn(),
}));

const bicicleta = { idBicicleta: 'b-1', titular: 'ALUMNO UNO', marcaModelo: 'Marca', color: 'Rojo' };

describe('W2 · Retiro manual del Supervisor (derivación)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });
    vi.mocked(extraerDescriptor).mockResolvedValue(new Array(128).fill(0.1));
    vi.mocked(autorizarRetiro).mockResolvedValue({ resultado: 'DENEGADO', estadoActualizado: 'DENTRO', distanciaEuclidiana: 0.8, umbralTheta: 0.37 });
  });
  afterEach(() => vi.clearAllMocks());

  it('tras un DENEGADO el Supervisor autoriza con el DNI de 8 dígitos', async () => {
    vi.mocked(retiroManual).mockResolvedValue({ resultado: 'AUTORIZADO_MANUAL', estadoActualizado: 'FUERA' });
    const alTerminar = vi.fn();
    const usuario = userEvent.setup();
    render(<VerificacionRetiro bicicleta={bicicleta} inicioMs={0} alTerminar={alTerminar} alCancelar={vi.fn()} permiteManual />);

    expect(screen.queryByLabelText(/DNI del titular/)).not.toBeInTheDocument();
    await usuario.click(await screen.findByRole('button', { name: 'Capturar y verificar' }));
    const dni = await screen.findByLabelText(/DNI del titular/);
    const autorizar = screen.getByRole('button', { name: 'Autorizar retiro manual' });
    await usuario.type(dni, '12ab3456');
    expect(dni).toHaveValue('123456');
    expect(autorizar).toBeDisabled();
    await usuario.type(dni, '78');
    await usuario.click(autorizar);

    expect(retiroManual).toHaveBeenCalledWith('b-1', '12345678');
    expect(alTerminar).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'MANUAL' }));
  });

  it('el Garitero solo puede derivar; no ve el formulario de DNI', async () => {
    const usuario = userEvent.setup();
    render(<VerificacionRetiro bicicleta={bicicleta} inicioMs={0} alTerminar={vi.fn()} alCancelar={vi.fn()} />);
    await usuario.click(await screen.findByRole('button', { name: 'Capturar y verificar' }));
    expect(await screen.findByRole('button', { name: 'Derivar al supervisor' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/DNI del titular/)).not.toBeInTheDocument();
  });
});
