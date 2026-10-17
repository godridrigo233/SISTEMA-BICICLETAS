import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { leerSesion } from './features/auth/SesionContext';
import { configurarInterceptores } from './services/apiClient';
import './estilos.css';

configurarInterceptores({
  obtenerToken: () => leerSesion()?.token,
  cerrarSesion: () => window.dispatchEvent(new Event('sesion-expirada')),
  avisar: (mensaje) => window.dispatchEvent(new CustomEvent('aviso-global', { detail: mensaje })),
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
