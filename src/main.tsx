import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import './styles/fonts.css'
import './index.css'
import './styles/mobile-perf.css'
import App from './App'
import { createLogger } from './utils/logUtils'
import logger from './utils/logger'

// En producción silenciamos los logs verbosos (console.log/info/debug). El juego
// tiene cientos de console.log "crudos" en rutas calientes (combos, spawns) que no
// pasan por el logger y degradan el rendimiento en sesiones largas, sobre todo en
// móvil. Conservamos warn y error.
if (import.meta.env.PROD) {
  const noop = () => {};
  // eslint-disable-next-line no-console
  console.log = noop;
  // eslint-disable-next-line no-console
  console.info = noop;
  // eslint-disable-next-line no-console
  console.debug = noop;
}

// Nota: StrictMode causa que algunos componentes se renderizen dos veces en desarrollo
// Esto es intencional y ayuda a identificar efectos secundarios inesperados
// En producción, este comportamiento no ocurre
// Si prefieres evitar esto durante desarrollo, puedes remover StrictMode

// Imprimir un mensaje de bienvenida en la consola
console.clear(); // Limpiar la consola para una mejor visibilidad
console.log('%c┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓', 'color: #3366ff; font-weight: bold;');
console.log('%c┃                                                                              ┃', 'color: #3366ff; font-weight: bold;');
console.log('%c┃  %cConvergence Online %c- Juego de encontrar coincidencias                        ┃', 'color: #3366ff; font-weight: bold;', 'color: #ff6600; font-weight: bold; font-size: 14px;', 'color: #3366ff;');
console.log('%c┃                                                                              ┃', 'color: #3366ff; font-weight: bold;');
console.log('%c┃  %cVersión: 1.0.0                                                             ┃', 'color: #3366ff; font-weight: bold;', 'color: #009933;');
console.log('%c┃  %cModo: Desarrollo                                                           ┃', 'color: #3366ff; font-weight: bold;', 'color: #009933;');
console.log('%c┃                                                                              ┃', 'color: #3366ff; font-weight: bold;');
console.log('%c┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛', 'color: #3366ff; font-weight: bold;');
console.log('');

// Crear un logger para la aplicación principal
const appLogger = createLogger('Main');

// Registrar el inicio de la aplicación
appLogger.info('Iniciando aplicación', {
  versión: '1.0.0',
  entorno: import.meta.env.MODE,
  navegador: navigator.userAgent,
});

// Medimos el tiempo de carga de la aplicación
const appStartTimer = appLogger.timer('renderización-inicial');

// Elemento raíz para el render
const rootElement = document.getElementById('root');

// Verificar que el elemento raíz exista
if (!rootElement) {
  appLogger.error('No se encontró el elemento raíz "root"');
  throw new Error('No se pudo encontrar el elemento root. Por favor, verifica tu HTML.');
}

// Renderizar la aplicación
createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);

// Registrar que la aplicación fue renderizada
setTimeout(() => {
  appStartTimer.end();
  appLogger.info('Aplicación renderizada correctamente');
}, 0);

// Registrar mensajes útiles para depuración en la consola
appLogger.debug('Consejos de depuración:', {
  redux: 'Para ver el estado completo: store.getState()',
  componentes: 'Los componentes en StrictMode se renderizan dos veces en desarrollo',
  logs: 'Usa LogLevel.DEBUG para ver todos los logs o LogLevel.INFO para reducir la verbosidad',
});
