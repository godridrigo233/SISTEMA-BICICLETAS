import { describe, expect, it } from 'vitest';
import { cumplePolitica } from './politicaContrasena';

describe('Política de contraseña (igual a la de la API)', () => {
  it.each([
    ['corta1', false],
    ['solamenteletras', false],
    ['1234567890123', false],
    ['MiBicicleta2026', true],
  ])('«%s» → %s', (valor, esperado) => {
    expect(cumplePolitica(valor)).toBe(esperado);
  });
});
