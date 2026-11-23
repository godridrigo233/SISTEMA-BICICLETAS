import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { configureAxe } from 'vitest-axe';
import AyudaPage from './AyudaPage';
import { useSesion } from '../auth/SesionContext';

vi.mock('../auth/SesionContext', () => ({ useSesion: vi.fn() }));

// Se desactiva únicamente la regla color-contrast porque jsdom no calcula estilos y daría falsos resultados.
const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } });

describe('Ayuda y Soporte (Accesibilidad)', () => {
  it('no presenta violaciones de accesibilidad con axe', async () => {
    vi.mocked(useSesion).mockReturnValue({ sesion: { idRol: 3 } });
    const { container } = render(<MemoryRouter><AyudaPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Ayuda y Soporte' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
