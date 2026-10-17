import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('muestra el nombre propio del sistema (Nielsen H5: no confundirlo con otras plataformas)', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Sistema de Control de Accesos de Bicicletas' }),
    ).toBeInTheDocument();
  });
});
