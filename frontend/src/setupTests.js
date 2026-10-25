import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);

// Mock de getContext para evitar advertencias de jsdom en axe-core
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => null;
}

// Sin globals de Vitest, Testing Library no limpia el DOM entre pruebas automáticamente.
afterEach(cleanup);
