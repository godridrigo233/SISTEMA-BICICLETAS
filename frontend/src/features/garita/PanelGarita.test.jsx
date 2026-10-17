import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PanelGarita from './PanelGarita';
import { consultarPorQr, registrarIngreso } from '../../services/garitaService';

vi.mock('../../services/garitaService', () => ({ consultarPorQr: vi.fn(), registrarIngreso: vi.fn() }));

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
  });

  it('enfoca el campo QR al abrir la pantalla (Nielsen H7)', () => {
    render(<PanelGarita />);
    expect(screen.getByLabelText('Código QR de la bicicleta')).toHaveFocus();
  });

  it('con la bicicleta FUERA registra el ingreso con Enter y lo agrega a los últimos movimientos', async () => {
    vi.mocked(consultarPorQr).mockResolvedValue(bici('FUERA'));
    vi.mocked(registrarIngreso).mockResolvedValue({ resultado: 'EXITOSO', estadoActualizado: 'DENTRO' });
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

  it('con la bicicleta DENTRO no ofrece ingreso y anuncia la verificación facial', async () => {
    vi.mocked(consultarPorQr).mockResolvedValue(bici('DENTRO'));
    const usuario = userEvent.setup();
    render(<PanelGarita />);

    await escanear(usuario);
    expect(await screen.findByText(/requiere verificación facial/)).toBeInTheDocument();
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
});
