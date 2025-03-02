import { Middleware } from 'redux';

// Constante para identificar acciones API
export const RSAA = 'RSAA';

export interface ApiAction {
  [RSAA]: {
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    types: [string, string, string]; // [request, success, failure]
  };
}

export const apiMiddleware: Middleware = ({ dispatch }) => (next) => async (action) => {
  // Verificar si es una acción API
  if (!action[RSAA]) {
    return next(action);
  }

  const { endpoint, method, headers = {}, body, types } = action[RSAA];
  const [requestType, successType, failureType] = types;

  // Dispatch de acción de request
  dispatch({ type: requestType });

  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error en la petición');
    }

    // Dispatch de acción de éxito
    return dispatch({
      type: successType,
      payload: data
    });
  } catch (error) {
    // Dispatch de acción de error
    return dispatch({
      type: failureType,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};
