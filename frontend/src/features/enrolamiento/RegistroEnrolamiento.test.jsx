import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RegistroEnrolamiento from './RegistroEnrolamiento';
import { enrolar, obtenerPerfil, registrarBicicleta } from '../../services/estudianteService';
import { capturarParaEnrolamiento } from '../../biometria/extractorFacial';
import { nombreAbreviado } from './sticker';

vi.mock('../../services/estudianteService', () => ({ obtenerPerfil: vi.fn(), registrarBicicleta: vi.fn(), enrolar: vi.fn() }));
vi.mock('../../biometria/extractorFacial', () => ({
  prepararBiometria: vi.fn().mockResolvedValue({}),
  sinAceleracionGrafica: vi.fn().mockReturnValue(false),
  obtenerFaceApi: vi.fn().mockResolvedValue({}),
  cargarModelos: vi.fn().mockResolvedValue([]),
  extraerDescriptor: vi.fn(),
  abrirCamara: vi.fn(() => navigator.mediaDevices.getUserMedia()),
  // La captura automática no logra la calidad en las pruebas de componente: se ejercita el respaldo manual.
  capturarAutomaticamente: vi.fn(() => Promise.reject(Object.assign(new Error('Pida al estudiante que mire de frente a la cámara.'), { codigo: 'TIEMPO_AGOTADO' }))),
  capturarParaEnrolamiento: vi.fn(),
}));
vi.mock('./sticker', async (original) => ({ ...(await original()), qrComoDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,AA'), descargarSticker: vi.fn() }));

const perfil = { nombres: 'Juan Carlos', apellidos: 'Pérez Ramos', codigoUniversitario: '2020123456', facultad: 'Ingeniería', enrolado: false, bicicletas: [] };
const bici = { idBicicleta: 'b-1', codigoQr: '11111111-2222-3333-4444-555555555555', marcaModelo: 'Trek', color: 'Rojo', estado: 'FUERA' };

describe('W4 · Registro y Enrolamiento (CU-01)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });
    vi.mocked(obtenerPerfil).mockResolvedValue(perfil);
    vi.mocked(capturarParaEnrolamiento).mockResolvedValue(new Array(128).fill(0.2));
  });
  afterEach(() => vi.clearAllMocks());

  it('mantiene «Completar registro» deshabilitado hasta tener datos, consentimiento y descriptor', async () => {
    const usuario = userEvent.setup();
    render(<RegistroEnrolamiento />);
    const enviar = await screen.findByRole('button', { name: 'Completar registro' });
    expect(enviar).toBeDisabled();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    const pendientes = screen.getByRole('list', { name: 'Pendiente para completar el registro' });
    expect(pendientes).toHaveTextContent('Número de marco (pendiente)');
    expect(pendientes).toHaveTextContent('Capturar su rostro (pendiente)');

    await usuario.type(screen.getByLabelText(/Número de marco/), 'wtu123');
    await usuario.type(screen.getByLabelText(/Marca y modelo/), 'Trek');
    await usuario.selectOptions(screen.getByLabelText(/Color/), 'Rojo');
    expect(enviar).toBeDisabled();

    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(await screen.findByRole('button', { name: 'Capturar rostro' }));
    expect(await screen.findByText(/Rostro capturado correctamente/)).toBeInTheDocument();
    expect(enviar).toBeEnabled();
    expect(screen.queryByRole('list', { name: 'Pendiente para completar el registro' })).not.toBeInTheDocument();
  });

  it('registra la bicicleta, envía el descriptor y muestra el QR para descargar', async () => {
    vi.mocked(registrarBicicleta).mockResolvedValue(bici);
    const usuario = userEvent.setup();
    render(<RegistroEnrolamiento />);
    await usuario.type(await screen.findByLabelText(/Número de marco/), 'WTU123');
    await usuario.type(screen.getByLabelText(/Marca y modelo/), 'Trek');
    await usuario.selectOptions(screen.getByLabelText(/Color/), 'Rojo');
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(await screen.findByRole('button', { name: 'Capturar rostro' }));
    await screen.findByText(/Rostro capturado correctamente/);
    await usuario.click(screen.getByRole('button', { name: 'Completar registro' }));

    expect(await screen.findByText(/Registro completado/)).toBeInTheDocument();
    expect(registrarBicicleta).toHaveBeenCalledWith(expect.objectContaining({ numeroMarco: 'WTU123', color: 'Rojo' }));
    expect(vi.mocked(enrolar).mock.calls[0][0]).toHaveLength(128);
    expect(screen.getByRole('button', { name: 'Descargar sticker QR' })).toBeInTheDocument();
  });

  it('abrevia el nombre del sticker para no exponer el nombre completo', () => {
    expect(nombreAbreviado('Juan Carlos', 'PÉREZ RAMOS')).toBe('J. Pérez R.');
    expect(nombreAbreviado('Ana', 'Quispe')).toBe('A. Quispe');
  });
});

describe('W4 · Captura automática del enrolamiento', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });
    vi.mocked(obtenerPerfil).mockResolvedValue(perfil);
  });
  afterEach(() => vi.clearAllMocks());

  it('si las dos capturas no coinciden, no acepta el rostro y explica cómo repetir', async () => {
    vi.mocked(capturarParaEnrolamiento).mockRejectedValueOnce(Object.assign(
      new Error('Las dos capturas no coinciden lo suficiente. Repita la captura mirando de frente, quieto y con buena iluminación.'),
      { codigo: 'CAPTURAS_INCONSISTENTES' },
    ));
    const usuario = userEvent.setup();
    render(<RegistroEnrolamiento />);
    await usuario.click(await screen.findByRole('checkbox'));
    await usuario.click(await screen.findByRole('button', { name: 'Capturar rostro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Las dos capturas no coinciden');
    expect(screen.getByRole('button', { name: 'Completar registro' })).toBeDisabled();
    expect(vi.mocked(capturarParaEnrolamiento).mock.calls[0][2]).toMatchObject({ senal: expect.any(AbortSignal) });
  });
});
