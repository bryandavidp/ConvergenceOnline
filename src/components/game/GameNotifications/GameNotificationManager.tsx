import React, { useState, useCallback } from 'react';
import GameNotification, { NotificationType } from './GameNotification';
import './GameNotificationManager.css';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  icon?: string;
  duration?: number;
  value?: string | number;
  animateValue?: boolean;
}

interface GameNotificationManagerProps {
  position?: 'top' | 'center' | 'bottom';
}

/**
 * Componente para gestionar y mostrar múltiples notificaciones del juego
 */
const GameNotificationManager: React.FC<GameNotificationManagerProps> = ({ 
  position = 'top' 
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Eliminar una notificación por ID
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);
  
  // Añadir una nueva notificación
  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification = { ...notification, id };
    
    // Limitar a máximo 2 notificaciones
    setNotifications(prev => {
      // Si ya hay 2 o más notificaciones, eliminar la más antigua
      if (prev.length >= 3) {
        return [...prev.slice(1), newNotification];
      }
      // De lo contrario, añadir la nueva
      return [...prev, newNotification];
    });
    
    return id;
  }, []);
  
  return (
    <div className={`notification-manager ${position}`}>
      {notifications.map(notification => (
        <div className="notification-wrapper" key={notification.id}>
          <GameNotification
            message={notification.message}
            type={notification.type}
            icon={notification.icon}
            duration={notification.duration || 2400}
            visible={true}
            onHide={() => removeNotification(notification.id)}
            value={notification.value}
            animateValue={notification.animateValue}
          />
        </div>
      ))}
    </div>
  );
};

// Contexto para el sistema de notificaciones
import { createContext, useContext } from 'react';

interface NotificationContextType {
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
}

export const NotificationContext = createContext<NotificationContextType | null>(null);

// Hook para usar notificaciones
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications debe usarse dentro de un NotificationProvider');
  }
  return context;
};

// Proveedor de notificaciones
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);
  
  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification = { ...notification, id };
    
    // Limitar a máximo 2 notificaciones
    setNotifications(prev => {
      // Si ya hay 2 o más notificaciones, eliminar la más antigua
      if (prev.length >= 2) {
        return [...prev.slice(1), newNotification];
      }
      // De lo contrario, añadir la nueva
      return [...prev, newNotification];
    });
    
    return id;
  }, []);
  
  return (
    <NotificationContext.Provider value={{ addNotification, removeNotification }}>
      {children}
      <div className="notification-manager top">
        {notifications.map((notification, index) => (
          <div 
            key={notification.id} 
            className="notification-wrapper"
            style={{ zIndex: 1000 + index }}
          >
            <GameNotification
              message={notification.message}
              type={notification.type}
              icon={notification.icon}
              duration={notification.duration || 3000}
              visible={true}
              onHide={() => removeNotification(notification.id)}
              value={notification.value}
              animateValue={notification.animateValue}
            />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export default GameNotificationManager; 