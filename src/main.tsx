import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App'
import logger from './utils/logger'

// Nota: StrictMode causa que algunos componentes se renderizen dos veces en desarrollo
// Esto es intencional y ayuda a identificar efectos secundarios inesperados
// En producción, este comportamiento no ocurre
// Si prefieres evitar esto durante desarrollo, puedes remover StrictMode

logger.info('Main', 'Iniciando aplicación');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
