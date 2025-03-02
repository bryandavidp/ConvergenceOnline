// src/store/middleware/loggerMiddleware.ts
import { Middleware } from '@reduxjs/toolkit';
import logger from '../../utils/logger';

export const loggerMiddleware: Middleware = store => next => action => {
  // Log la acción que va a ser ejecutada
  if (typeof action === 'object' && action !== null && 'type' in action) {
    logger.redux.action(String(action.type), (action as any).payload);
  } else {
    logger.redux.action('Unknown Action', action);
  }
  
  // Guardar el estado actual antes de dispatch
  const prevState = store.getState();
  
  // Ejecutar la acción
  const result = next(action);
  
  // Obtener el nuevo estado después del dispatch
  const nextState = store.getState();
  
  // Log el cambio de estado
  logger.redux.state(prevState, nextState);
  
  // Retornar el resultado
  return result;
};