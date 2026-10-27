import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@vladmandic/face-api')) {
              return 'vendor-faceapi';
            }
            if (id.includes('qrcode')) {
              return 'vendor-qrcode';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('axios')) {
              return 'vendor-axios';
            }
          }
        },
      },
    },
    // La librería facial incluye TensorFlow.js (≈1.3 MB; 340 kB comprimida): se carga de forma diferida
    // solo en la garita y el enrolamiento, y el navegador la guarda en caché (Cache-Control immutable).
    chunkSizeWarningLimit: 1400,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/setupTests.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],          // lcov → SonarCloud
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/**/*.test.{js,jsx}', 'src/setupTests.js'],
    },
  },
});
