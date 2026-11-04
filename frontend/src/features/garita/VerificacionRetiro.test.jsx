import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VerificacionRetiro from './VerificacionRetiro';
import { capturarAutomaticamente, extraerDescriptor } from '../../biometria/extractorFacial';
import { autorizarRetiro } from '../../services/garitaService';

vi.mock('../../services/garitaService', () => ({ autorizarRetiro: vi.fn() }));
vi.mock('../../biometria/extractorFacial', () => ({
  prepararBiometria: vi.fn().mockResolvedValue({}),
  sinAceleracionGrafica: vi.fn().mockReturnValue(false),
  obtenerFaceApi: vi.fn().mockResolvedValue({}),
  cargarModelos: vi.fn().mockResolvedValue([]),
  extraerDescriptor: vi.fn(),
  abrirCamara: vi.fn(() => navigator.mediaDevices.getUserMedia()),
  // La captura automática no logra la calidad en las pruebas de componente: se ejercita el respaldo manual.
  capturarAutomaticamente: vi.fn((_video, _faceapi, { alDemorar } = {}) => {
    alDemorar?.('Pida al estudiante que mire de frente a la cámara.');
    return new Promise(() => {});
  }),
  capturarParaEnrolamiento: vi.fn(),
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Retiro denegado: el rostro no coincide con el del titular');
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

  it('indica al vigilante que oriente la cámara hacia el estudiante, que no ve la pantalla (observación P07)', async () => {
    montar();
    expect(await screen.findByText(/Oriente la cámara hacia el rostro del estudiante/)).toBeInTheDocument();
    expect(screen.getByText(/El estudiante no ve la pantalla: solo debe mirar a la cámara/)).toBeInTheDocument();
  });

  it('si no se detecta el rostro, el mensaje se dirige al vigilante', async () => {
    vi.mocked(extraerDescriptor).mockRejectedValue(Object.assign(new Error('No se detectó el rostro con claridad.'), { codigo: 'NO_ROSTRO' }));
    const usuario = userEvent.setup();
    montar();

    await usuario.click(await screen.findByRole('button', { name: 'Capturar y verificar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Pida al estudiante que mire de frente a la cámara');
    expect(autorizarRetiro).not.toHaveBeenCalled();
  });

  it('avisa si no hay cámara disponible', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se detecta una cámara');
  });

  it('deja «Capturar y verificar» con el foco para capturar con Enter (Nielsen H7)', async () => {
    montar();
    const boton = await screen.findByRole('button', { name: 'Capturar y verificar' });
    await waitFor(() => expect(boton).toHaveFocus());
  });

  it('tras un DENEGADO permite cancelar y explica la diferencia en lenguaje llano (Nielsen H2 y H3)', async () => {
    vi.mocked(autorizarRetiro).mockResolvedValue({ resultado: 'DENEGADO', estadoActualizado: 'DENTRO', distanciaEuclidiana: 0.68, umbralTheta: 0.37 });
    const usuario = userEvent.setup();
    const alCancelar = vi.fn();
    render(<VerificacionRetiro bicicleta={bicicleta} alTerminar={vi.fn()} alCancelar={alCancelar} />);

    await usuario.click(await screen.findByRole('button', { name: 'Capturar y verificar' }));

    expect(await screen.findByText(/Diferencia con el rostro registrado/)).toHaveTextContent('0.68');
    expect(screen.getByText('Se acepta hasta 0.37')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(alCancelar).toHaveBeenCalledOnce();
  });
});

describe('W2 · Captura automática del retiro', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });
  });
  afterEach(() => vi.clearAllMocks());

  it('captura sola cuando la calidad se cumple y envía el descriptor sin que el vigilante haga clic', async () => {
    vi.mocked(capturarAutomaticamente).mockResolvedValueOnce({ descriptor: new Array(128).fill(0.1), inicioCaptura: performance.now() });
    vi.mocked(autorizarRetiro).mockResolvedValue({ resultado: 'AUTORIZADO', estadoActualizado: 'FUERA', distanciaEuclidiana: 0.21, umbralTheta: 0.37 });
    const alTerminar = montar();

    await waitFor(() => expect(autorizarRetiro).toHaveBeenCalledWith('b-1', expect.any(Array), expect.any(Number)));
    expect(vi.mocked(capturarAutomaticamente).mock.calls[0][2]).toMatchObject({ destinatario: 'vigilante' });
    expect(extraerDescriptor).not.toHaveBeenCalled();
    await waitFor(() => expect(alTerminar).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'EXITOSO' })));
  });

  it('mientras busca, indica al vigilante qué corregir (Nielsen H1)', async () => {
    vi.mocked(capturarAutomaticamente).mockImplementationOnce((_v, _f, { alCambiar }) => {
      alCambiar({ apta: false, problema: 'NO_DE_FRENTE', mensaje: 'Pida al estudiante que mire de frente a la cámara.', estables: 0, cuadrosEstables: 5 });
      return new Promise(() => {});
    });
    montar();
    await waitFor(() => expect(screen.getByText(/Captura automática:/).parentElement).toHaveTextContent('Pida al estudiante que mire de frente a la cámara.'));
    expect(screen.queryByRole('button', { name: 'Capturar y verificar' })).not.toBeInTheDocument();
  });

  it('si tarda, sigue intentando y ofrece además la captura manual', async () => {
    montar();
    expect(await screen.findByText(/La captura automática sigue intentando/)).toHaveTextContent('Pida al estudiante que mire de frente a la cámara.');
    expect(screen.getByRole('button', { name: 'Capturar y verificar' })).toBeEnabled();
    expect(screen.getByText(/Captura automática:/)).toBeInTheDocument();
  });
});
