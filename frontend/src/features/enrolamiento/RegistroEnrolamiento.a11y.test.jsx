import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAxe } from 'vitest-axe';
import RegistroEnrolamiento from './RegistroEnrolamiento';
import { obtenerPerfil } from '../../services/estudianteService';

vi.mock('../../services/estudianteService', () => ({
  obtenerPerfil: vi.fn(),
  registrarBicicleta: vi.fn(),
  enrolar: vi.fn(),
}));

vi.mock('../../biometria/extractorFacial', () => ({
  prepararBiometria: vi.fn().mockResolvedValue({}),
  sinAceleracionGrafica: vi.fn().mockReturnValue(false),
  obtenerFaceApi: vi.fn().mockResolvedValue({}),
  cargarModelos: vi.fn().mockResolvedValue([]),
  extraerDescriptor: vi.fn(),
}));

vi.mock('./sticker', async (original) => ({
  ...(await original()),
  qrComoDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,AA'),
  descargarSticker: vi.fn(),
}));

// Se desactiva únicamente la regla color-contrast porque jsdom no calcula estilos y daría falsos resultados.
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

const perfilEjemplo = {
  nombres: 'Juan Carlos',
  apellidos: 'Pérez Ramos',
  codigoUniversitario: '2020123456',
  facultad: 'Ingeniería',
  enrolado: false,
  bicicletas: [],
};

describe('W4 · Registro y Enrolamiento (Accesibilidad)', () => {
  beforeEach(() => {
    vi.mocked(obtenerPerfil).mockResolvedValue(perfilEjemplo);
  });

  it('no presenta violaciones de accesibilidad con axe en estado inicial (sin cámara activa)', async () => {
    const { container } = render(<RegistroEnrolamiento />);
    await screen.findByText(/Mis datos/);
    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
