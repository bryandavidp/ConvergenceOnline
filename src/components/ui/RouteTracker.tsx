import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Componente que rastrea la ruta actual y actualiza el atributo data-route en el body
 * para aplicar estilos específicos basados en la ruta.
 */
const RouteTracker: React.FC = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Actualizar el atributo data-route en el body con la ruta actual
    document.body.setAttribute('data-route', location.pathname);
    
    // Limpiar cualquier clase especial al cambiar de ruta
    const prevGameClasses = document.body.classList.contains('in-game-page');
    if (location.pathname !== '/game' && prevGameClasses) {
      document.body.classList.remove('in-game-page');
      
      // Restaurar el comportamiento normal del scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.height = '';
      document.body.style.width = '';
      document.documentElement.style.overscrollBehavior = '';
    }
    
    // Restablecer el scroll al inicio al cambiar de ruta
    window.scrollTo(0, 0);
    
    return () => {
      // No eliminar el atributo data-route al desmontar para permitir las transiciones de salida
    };
  }, [location.pathname]);
  
  // Este componente no renderiza nada
  return null;
};

export default RouteTracker; 