import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HistorialPage from './HistorialPage';
import { consultarHistorial, obtenerPerfil } from '../../services/estudianteService';

vi.mock('../../services/estudianteService', () => ({ consultarHistorial: vi.fn(), obtenerPerfil: vi.fn() }));

const pagina = (total, numeroPagina = 1) => ({
  total, numeroPagina, tamanoPagina: 10,
  elementos: [{ fechaUtc: '2026-10-17T13:05:00Z', tipoEvento: 'RETIRO', resultado: 'DENEGADO', registro: 'AUTOMATICO', bicicleta: 'Trek (Azul)' }],
});

describe('W5 · Historial personal', () => {
  beforeEach(() => {
    vi.mocked(obtenerPerfil).mockResolvedValue({ nombres: 'Juan', apellidos: 'Pérez Ramos', bicicletas: [{ codigoQr: 'qr-1', marcaModelo: 'Trek', color: 'Azul', estado: 'FUERA' }] });
    vi.mocked(consultarHistorial).mockResolvedValue(pagina(25));
  });
  afterEach(() => vi.clearAllMocks());

  it('muestra los movimientos en hora de Perú y pagina', async () => {
    const usuario = userEvent.setup();
    render(<HistorialPage />);
    expect(await screen.findByText('✗ Denegado')).toBeInTheDocument();
    expect(screen.getByText(/17\/10\/(20)?26.*08:05:00/)).toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Siguiente ›' }));
    expect(consultarHistorial).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 }));
  });

  it('bloquea un rango de fechas invertido y filtra por tipo', async () => {
    const usuario = userEvent.setup();
    render(<HistorialPage />);
    await screen.findByText('✗ Denegado');
    await usuario.type(screen.getByLabelText('Desde'), '2026-10-10');
    await usuario.type(screen.getByLabelText('Hasta'), '2026-10-01');
    expect(screen.getByRole('button', { name: 'Filtrar' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('no puede ser posterior');

    await usuario.clear(screen.getByLabelText('Hasta'));
    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'RETIRO');
    await usuario.click(screen.getByRole('button', { name: 'Filtrar' }));
    expect(consultarHistorial).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: 'RETIRO', desde: '2026-10-10', pagina: 1 }));
  });

  it('muestra cada bicicleta con su estado y remite a «Mi registro» para los stickers', async () => {
    vi.mocked(obtenerPerfil).mockResolvedValue({
      nombres: 'Juan', apellidos: 'Pérez Ramos',
      bicicletas: [
        { codigoQr: 'qr-1', marcaModelo: 'Trek', color: 'Azul', estado: 'FUERA' },
        { codigoQr: 'qr-2', marcaModelo: 'GT Avalanche', color: 'Negro', estado: 'DENTRO' },
      ],
    });
    render(<HistorialPage />);
    const lista = await screen.findByRole('region', { name: 'Mis bicicletas' });
    expect(lista).toHaveTextContent('Trek (Azul)');
    expect(lista).toHaveTextContent('GT Avalanche (Negro)');
    expect(lista).toHaveTextContent('FUERA');
    expect(lista).toHaveTextContent('DENTRO');
    expect(screen.getByRole('link', { name: 'Mi registro' })).toHaveAttribute('href', '/estudiante/registro');
    expect(screen.queryByRole('button', { name: 'Ver mi QR' })).not.toBeInTheDocument();
  });

  it('sin bicicletas, indica que debe registrarla en «Mi registro»', async () => {
    vi.mocked(obtenerPerfil).mockResolvedValue({ nombres: 'Juan', apellidos: 'Pérez Ramos', bicicletas: [] });
    render(<HistorialPage />);
    expect(await screen.findByText(/Aún no registras una bicicleta/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Mis bicicletas' })).not.toBeInTheDocument();
  });
});
