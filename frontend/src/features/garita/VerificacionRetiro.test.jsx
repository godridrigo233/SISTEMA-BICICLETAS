import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VerificacionRetiro from './VerificacionRetiro';
import { extraerDescriptor } from '../../biometria/extractorFacial';
import { autorizarRetiro } from '../../services/garitaService';

vi.mock('../../services/garitaService', () => ({ autorizarRetiro: vi.fn() }));
vi.mock('../../biometria/extractorFacial', () => ({
  obtenerFaceApi: vi.fn().mockResolvedValue({}),
  cargarModelos: vi.fn().mockResolvedValue([]),
  extraerDescriptor: vi.fn(),
}));

const bicicleta = { idBicicleta: 'b-1', titular: 'ALUMNO UNO', marcaModelo: 'Marca', color: 'Rojo' };
const detener = vi.fn();

function montar(alTerminar = vi.fn()) {
  render(<VerificacionRetiro bicicleta={bicicleta} alTerminar={alTerminar} alCancelar={vi.fn()} />);
  return alTerminar;
}

describe('W2 · Verificación facial del retiro (CU-04)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: detener }] }) },
    });
    vi.mocked(extraerDescriptor).mockResolvedValue(new Array(128).fill(0.1));
  });

  afterEach(() => vi.clearAllMocks());

  it('envía solo el descriptor de 128 valores y comunica el retiro autorizado', async () => {
    vi.mocked(autorizarRetiro).mockResolvedValue({ resultado: 'AUTORIZADO', estadoActualizado: 'FUERA', distanciaEuclidiana: 0.29, umbralTheta: 0.37 });
    const usuario = userEvent.setup();
    const alTerminar = montar();

    await usuario.click(await screen.findByRole('button', { name: 'Capturar y verificar' }));

    expect(autorizarRetiro).toHaveBeenCalledWith('b-1', expect.any(Array), expect.any(Number));
    expect(vi.mocked(autorizarRetiro).mock.calls[0][1]).toHaveLength(128);
    expect(alTerminar).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'EXITOSO' }));
  });

  it('ante un DENEGADO ofrece reintentar o derivar al supervisor (RF-07)', async () => {
    vi.mocked(autorizarRetiro).mockResolvedValue({ resultado: 'DENEGADO', estadoActualizado: 'DENTRO', distanciaEuclidiana: 0.68, umbralTheta: 0.37 });
    const usuario = userEvent.setup();
    const alTerminar = montar();

    await usuario.click(await screen.findByRole('button', { name: 'Capturar y verificar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Retiro denegado: el rostro no coincide (0.68)');
    expect(screen.getByRole('button', { name: 'Reintentar captura' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Derivar al supervisor' }));
    expect(alTerminar).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'DENEGADO' }));
  });

  it('pide repetir la captura si no se detecta un único rostro (CU-04 3a)', async () => {
    vi.mocked(extraerDescriptor).mockRejectedValue(new Error('Hay más de un rostro en el encuadre. Solo debe aparecer el titular.'));
    const usuario = userEvent.setup();
    montar();

    await usuario.click(await screen.findByRole('button', { name: 'Capturar y verificar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('más de un rostro');
    expect(autorizarRetiro).not.toHaveBeenCalled();
  });

  it('avisa si no hay cámara disponible', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se detecta una cámara');
  });
});
