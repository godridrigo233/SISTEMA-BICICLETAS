import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './apiClient';
import { enrolar } from './estudianteService';

describe('estudianteService.enrolar', () => {
  afterEach(() => vi.restoreAllMocks());

  it('registra el descriptor con la versión del modelo de la calibración de θ (@vladmandic/face-api 1.7.15, SSD)', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: {} });
    const descriptor = new Array(128).fill(0.1);
    await enrolar(descriptor);
    expect(put).toHaveBeenCalledWith('/estudiante/enrolamiento', { descriptor, consentimientoAceptado: true, versionModelo: 'vlad-1.7.15-ssd' });
  });
});
