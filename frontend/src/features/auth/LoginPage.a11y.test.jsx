import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAxe } from 'vitest-axe';
import LoginPage from './LoginPage';
import { SesionProvider } from './SesionContext';
import { iniciarSesion } from '../../services/authService';

vi.mock('../../services/authService', () => ({ iniciarSesion: vi.fn() }));

// Se desactiva únicamente la regla color-contrast porque jsdom no calcula estilos y daría falsos resultados.
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

function montar() {
  return render(
    <SesionProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </SesionProvider>,
  );
}

describe('W1 · LoginPage (Accesibilidad)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(iniciarSesion).mockReset();
  });

  it('no presenta violaciones de accesibilidad con axe en estado inicial', async () => {
    const { container } = montar();
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
