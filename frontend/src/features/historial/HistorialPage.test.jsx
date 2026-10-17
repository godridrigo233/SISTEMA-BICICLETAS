import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HistorialPage from './HistorialPage';
import { consultarHistorial, obtenerPerfil } from '../../services/estudianteService';

vi.mock('../../services/estudianteService', () => ({ consultarHistorial: vi.fn(), obtenerPerfil: vi.fn() }));
vi.mock('../enrolamiento/sticker', () => ({
  qrComoDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,AA'), descargarSticker: vi.fn(), nombreAbreviado: () => 'J. Pérez R.',
}));

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

  it('«Ver mi QR» abre el diálogo con el sticker descargable', async () => {
    const usuario = userEvent.setup();
    render(<HistorialPage />);
    await usuario.click(await screen.findByRole('button', { name: 'Ver mi QR' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar sticker QR' })).toBeInTheDocument();
  });
});
