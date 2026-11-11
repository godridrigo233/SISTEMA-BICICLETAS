import { render, screen, waitFor } from '@testing-library/react';
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
  capturarAutomaticamente: vi.fn((_video, _faceapi, { alDemorar } = {}) => {
    alDemorar?.('Pida al estudiante que mire de frente a la cámara.');
    return new Promise(() => {});
  }),
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

describe('W4 · Luz de pantalla durante la captura', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });
    vi.mocked(obtenerPerfil).mockResolvedValue(perfil);
  });
  afterEach(() => vi.clearAllMocks());

  it('mientras captura, pone la pantalla en blanco alrededor del video y permite cancelar', async () => {
    let cancelar;
    vi.mocked(capturarParaEnrolamiento).mockImplementationOnce((_v, _f, { senal }) => new Promise((_ok, fallar) => {
      cancelar = () => fallar(Object.assign(new Error('Captura cancelada.'), { codigo: 'CANCELADO' }));
      senal.addEventListener('abort', cancelar);
    }));
    const usuario = userEvent.setup();
    const { container } = render(<RegistroEnrolamiento />);
    await usuario.click(await screen.findByRole('checkbox'));
    await usuario.click(await screen.findByRole('button', { name: 'Capturar rostro' }));

    expect(container.querySelector('.camara.modo-luz')).not.toBeNull();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar captura' }));
    await waitFor(() => expect(container.querySelector('.camara.modo-luz')).toBeNull());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('W4 · Estudiante con bicicleta registrada', () => {
  const biciRegistrada = { idBicicleta: 'b-1', codigoQr: '11111111-2222-3333-4444-555555555555', numeroMarco: 'WTU123', marcaModelo: 'Trek', color: 'Rojo', rasgosDistintivos: null, estado: 'FUERA' };
  const otra = { idBicicleta: 'b-2', codigoQr: '66666666-7777-8888-9999-000000000000', numeroMarco: 'GT999', marcaModelo: 'GT Avalanche', color: 'Azul', rasgosDistintivos: null, estado: 'FUERA' };
  const enrolado = { ...perfil, enrolado: true, bicicletas: [biciRegistrada] };

  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });
    vi.mocked(capturarParaEnrolamiento).mockResolvedValue(new Array(128).fill(0.2));
  });
  afterEach(() => vi.clearAllMocks());

  it('si ya está enrolado, lista sus bicicletas y no muestra la cámara ni el consentimiento', async () => {
    vi.mocked(obtenerPerfil).mockResolvedValue(enrolado);
    render(<RegistroEnrolamiento />);
    expect(await screen.findByRole('heading', { name: 'Mi registro' })).toBeInTheDocument();
    expect(screen.getByText(/Tu rostro ya está enrolado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar sticker de Trek (Rojo)' })).toBeInTheDocument();
    expect(screen.getByText('Fuera')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar mi enrolamiento' })).toBeEnabled();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('registra otra bicicleta sin volver a enrolar y muestra su sticker', async () => {
    vi.mocked(obtenerPerfil).mockResolvedValueOnce(enrolado).mockResolvedValue({ ...enrolado, bicicletas: [biciRegistrada, otra] });
    vi.mocked(registrarBicicleta).mockResolvedValue(otra);
    const usuario = userEvent.setup();
    render(<RegistroEnrolamiento />);
    await usuario.click(await screen.findByRole('button', { name: 'Registrar otra bicicleta' }));
    const registrar = screen.getByRole('button', { name: 'Registrar bicicleta' });
    expect(registrar).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Actualizar mi enrolamiento' })).toBeDisabled();

    await usuario.type(screen.getByLabelText(/Número de marco/), 'GT999');
    await usuario.type(screen.getByLabelText(/Marca y modelo/), 'GT Avalanche');
    await usuario.selectOptions(screen.getByLabelText(/Color/), 'Azul');
    await usuario.click(registrar);

    expect(await screen.findByText('Bicicleta registrada. Quedó en estado FUERA.')).toBeInTheDocument();
    expect(registrarBicicleta).toHaveBeenCalledWith(expect.objectContaining({ numeroMarco: 'GT999', color: 'Azul', rasgosDistintivos: null }));
    expect(enrolar).not.toHaveBeenCalled();
    expect(screen.getByText(otra.codigoQr)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Volver a Mi registro' }));
    expect(await screen.findByRole('button', { name: 'Descargar sticker de GT Avalanche (Azul)' })).toBeInTheDocument();
  });

  it('cancelar el registro de otra bicicleta limpia el formulario', async () => {
    vi.mocked(obtenerPerfil).mockResolvedValue(enrolado);
    const usuario = userEvent.setup();
    render(<RegistroEnrolamiento />);
    await usuario.click(await screen.findByRole('button', { name: 'Registrar otra bicicleta' }));
    await usuario.type(screen.getByLabelText(/Número de marco/), 'X1');
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText(/Número de marco/)).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Registrar otra bicicleta' }));
    expect(screen.getByLabelText(/Número de marco/)).toHaveValue('');
    expect(registrarBicicleta).not.toHaveBeenCalled();
  });

  it('actualiza el enrolamiento solo al pedirlo, con consentimiento y captura', async () => {
    vi.mocked(obtenerPerfil).mockResolvedValue(enrolado);
    const usuario = userEvent.setup();
    render(<RegistroEnrolamiento />);
    await usuario.click(await screen.findByRole('button', { name: 'Actualizar mi enrolamiento' }));
    const guardar = screen.getByRole('button', { name: 'Guardar enrolamiento' });
    expect(guardar).toBeDisabled();

    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(await screen.findByRole('button', { name: 'Capturar rostro' }));
    await screen.findByText(/Rostro capturado correctamente/);
    await usuario.click(guardar);

    expect(await screen.findByText('Tu enrolamiento facial se guardó correctamente.')).toBeInTheDocument();
    expect(vi.mocked(enrolar).mock.calls[0][0]).toHaveLength(128);
    expect(registrarBicicleta).not.toHaveBeenCalled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('si tiene bicicleta pero falta el enrolamiento, muestra la captura directamente', async () => {
    vi.mocked(obtenerPerfil).mockResolvedValue({ ...enrolado, enrolado: false });
    render(<RegistroEnrolamiento />);
    expect(await screen.findByText(/Falta tu enrolamiento facial/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar mi enrolamiento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });
});
