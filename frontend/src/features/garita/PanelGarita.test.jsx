import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PanelGarita from './PanelGarita';
import { consultarMovimientosRecientes, consultarPorQr, registrarIngreso } from '../../services/garitaService';

vi.mock('../../services/garitaService', () => ({
  consultarPorQr: vi.fn(), registrarIngreso: vi.fn(), autorizarRetiro: vi.fn(), consultarMovimientosRecientes: vi.fn(),
}));
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

const QR = 'b0000000-0000-4000-8000-0000000000a1';
const bici = (estado) => ({
  idBicicleta: 'b0000000-0000-4000-8000-000000000001', codigoQr: QR, estado, numeroMarco: 'SEED-MARCO-0001',
  marcaModelo: 'Marca Prueba 1', color: 'Rojo', rasgosDistintivos: null, titular: 'ALUMNO UNO PRUEBA UNO', codigoUniversitario: '0000000001',
});

async function escanear(usuario) {
  // El lector 2D «escribe» el código y pulsa Enter.
  await usuario.type(screen.getByLabelText('Código QR de la bicicleta'), `${QR}{Enter}`);
}

describe('W2 · Panel de Garita — ingreso por QR (CU-03)', () => {
  beforeEach(() => {
    vi.mocked(consultarPorQr).mockReset();
    vi.mocked(registrarIngreso).mockReset();
    vi.mocked(consultarMovimientosRecientes).mockReset().mockResolvedValue([]);
  });

  it('enfoca el campo QR al abrir la pantalla (Nielsen H7)', () => {
    render(<PanelGarita />);
    expect(screen.getByLabelText('Código QR de la bicicleta')).toHaveFocus();
  });

  it('con la bicicleta FUERA registra el ingreso con Enter y lo agrega a los últimos movimientos', async () => {
    vi.mocked(consultarPorQr).mockResolvedValue(bici('FUERA'));
    vi.mocked(registrarIngreso).mockResolvedValue({ resultado: 'EXITOSO', estadoActualizado: 'DENTRO' });
    // Al abrir no hay movimientos; tras el ingreso la auditoría ya lo contiene (D-25).
    vi.mocked(consultarMovimientosRecientes).mockResolvedValueOnce([]).mockResolvedValue([
      { idAuditoria: 21, fechaUtc: new Date().toISOString(), tipoEvento: 'INGRESO', resultado: 'EXITOSO', titular: 'ALUMNO UNO PRUEBA UNO', bicicleta: 'Marca Prueba 1 / Rojo' },
    ]);
    const usuario = userEvent.setup();
    render(<PanelGarita />);

    await escanear(usuario);
    expect(await screen.findByText(/ALUMNO UNO PRUEBA UNO/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar ingreso' })).toHaveFocus();
    await usuario.keyboard('{Enter}');

    expect(await screen.findByRole('status')).toHaveTextContent('Ingreso registrado');
    expect(registrarIngreso).toHaveBeenCalledWith('b0000000-0000-4000-8000-000000000001', expect.any(Number));
    expect(screen.getByRole('cell', { name: 'INGRESO' })).toBeInTheDocument();
    expect(screen.getByLabelText('Código QR de la bicicleta')).toHaveValue('');
  });

  it('la latencia del ingreso mide la respuesta a la lectura del QR y no el tiempo de cotejo del vigilante (D-18)', async () => {
    let ahora = 1000;
    const reloj = vi.spyOn(performance, 'now').mockImplementation(() => ahora);
    vi.mocked(consultarPorQr).mockImplementation(async () => { ahora = 1180; return bici('FUERA'); }); // la consulta tarda 180 ms
    vi.mocked(registrarIngreso).mockResolvedValue({ resultado: 'EXITOSO', estadoActualizado: 'DENTRO' });
    const usuario = userEvent.setup();
    render(<PanelGarita />);

    await escanear(usuario);
    await screen.findByRole('button', { name: 'Registrar ingreso' });
    ahora = 9180; // el vigilante coteja la bicicleta durante 8 s antes de confirmar
    await usuario.keyboard('{Enter}');

    await screen.findByRole('status');
    expect(registrarIngreso).toHaveBeenCalledWith('b0000000-0000-4000-8000-000000000001', 180);
    reloj.mockRestore();
  });

  it('con la bicicleta DENTRO no ofrece ingreso y abre la verificación facial', async () => {
    vi.mocked(consultarPorQr).mockResolvedValue(bici('DENTRO'));
    const usuario = userEvent.setup();
    render(<PanelGarita />);

    await escanear(usuario);
    expect(await screen.findByRole('heading', { name: 'Verificación facial · Retiro' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar ingreso' })).not.toBeInTheDocument();
  });

  it('muestra «Código no registrado» ante un 404 (CU-03, 3a)', async () => {
    vi.mocked(consultarPorQr).mockRejectedValue({ response: { status: 404, data: {} } });
    const usuario = userEvent.setup();
    render(<PanelGarita />);

    await escanear(usuario);
    expect(await screen.findByRole('alert')).toHaveTextContent('Código no registrado');
  });

  it('sin conexión indica aplicar el protocolo de bitácora física (contingencia)', async () => {
    vi.mocked(consultarPorQr).mockRejectedValue(new Error('Network Error'));
    const usuario = userEvent.setup();
    render(<PanelGarita />);

    await escanear(usuario);
    expect(await screen.findByRole('alert')).toHaveTextContent('protocolo de bitácora física');
  });

  it('al abrir la garita muestra los movimientos que el operador registró hoy, aunque haya vuelto a iniciar sesión (D-25)', async () => {
    vi.mocked(consultarMovimientosRecientes).mockResolvedValue([
      { idAuditoria: 12, fechaUtc: '2026-11-17T21:05:00Z', tipoEvento: 'RETIRO', resultado: 'DENEGADO', titular: 'ALUMNO DOS PRUEBA', bicicleta: 'Marca Prueba 2 / Azul' },
      { idAuditoria: 11, fechaUtc: '2026-11-17T20:40:00Z', tipoEvento: 'INGRESO', resultado: 'EXITOSO', titular: 'ALUMNO UNO PRUEBA UNO', bicicleta: 'Marca Prueba 1 / Rojo' },
    ]);
    render(<PanelGarita />);

    const filas = await screen.findAllByRole('row');
    expect(filas).toHaveLength(3); // encabezado + 2 movimientos
    expect(filas[1]).toHaveTextContent(/0?4:05/);
    expect(filas[1]).toHaveTextContent('ALUMNO DOS PRUEBA');
    expect(filas[1]).toHaveTextContent('DENEGADO');
    expect(filas[2]).toHaveTextContent(/0?3:40/);
    expect(filas[2]).toHaveTextContent('Marca Prueba 1 / Rojo');
    expect(screen.queryByText(/Aún no hay movimientos/)).not.toBeInTheDocument();
  });

  it('tras registrar un ingreso vuelve a consultar la auditoría para mantener la tabla al día (D-25)', async () => {
    vi.mocked(consultarPorQr).mockResolvedValue(bici('FUERA'));
    vi.mocked(registrarIngreso).mockResolvedValue({ resultado: 'EXITOSO', estadoActualizado: 'DENTRO' });
    const usuario = userEvent.setup();
    render(<PanelGarita />);
    await waitFor(() => expect(consultarMovimientosRecientes).toHaveBeenCalledTimes(1));

    await escanear(usuario);
    await usuario.click(await screen.findByRole('button', { name: 'Registrar ingreso' }));

    await screen.findByRole('status');
    await waitFor(() => expect(consultarMovimientosRecientes).toHaveBeenCalledTimes(2));
  });

  it('si la consulta de movimientos falla, la garita sigue operando con las filas de la sesión', async () => {
    vi.mocked(consultarMovimientosRecientes).mockRejectedValue(new Error('Network Error'));
    vi.mocked(consultarPorQr).mockResolvedValue(bici('FUERA'));
    vi.mocked(registrarIngreso).mockResolvedValue({ resultado: 'EXITOSO', estadoActualizado: 'DENTRO' });
    const usuario = userEvent.setup();
    render(<PanelGarita />);

    expect(await screen.findByText('Aún no hay movimientos registrados hoy por este operador.')).toBeInTheDocument();
    await escanear(usuario);
    await usuario.click(await screen.findByRole('button', { name: 'Registrar ingreso' }));
    expect(await screen.findByRole('cell', { name: 'INGRESO' })).toBeInTheDocument();
  });

  it('con el QR ilegible, el código digitado identifica la bicicleta y la ficha muestra el número de marco para cotejarlo con el chasis (CU-03 2a)', async () => {
    vi.mocked(consultarPorQr).mockResolvedValue(bici('FUERA'));
    const usuario = userEvent.setup();
    render(<PanelGarita />);

    // El vigilante digita el código impreso en el sticker (o el que el estudiante muestra en «Mi registro») y pulsa Enter.
    await usuario.type(screen.getByLabelText('Código QR de la bicicleta'), `${QR}{Enter}`);
    expect(consultarPorQr).toHaveBeenCalledWith(QR);
    expect(await screen.findByText('N.º de marco')).toBeInTheDocument();
    expect(screen.getByText('SEED-MARCO-0001')).toBeInTheDocument();
  });
});
