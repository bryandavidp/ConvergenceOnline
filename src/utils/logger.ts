// src/utils/logger.ts
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

// Configuración del nivel de log
// En producción, se podría cambiar a WARN o ERROR
let currentLogLevel = LogLevel.DEBUG;

interface LogStyles {
  debug: string;
  info: string;
  warn: string;
  error: string;
  data: string;
  component: string;
  action: string;
  api: string;
  redux: string;
}

const styles: LogStyles = {
  debug: 'color: #888; font-weight: normal',
  info: 'color: #0099ff; font-weight: bold',
  warn: 'color: #ff9900; font-weight: bold',
  error: 'color: #ff0000; font-weight: bold',
  data: 'color: #00cc99; font-weight: normal',
  component: 'color: #9900cc; font-weight: bold',
  action: 'color: #cc6600; font-weight: bold',
  api: 'color: #3366ff; font-weight: bold',
  redux: 'color: #cc00cc; font-weight: bold'
};

// Funciones principales de logging
const logger = {
  setLogLevel(level: LogLevel) {
    currentLogLevel = level;
    logger.info(`Logger`, `Nivel de log establecido a: ${LogLevel[level]}`);
  },

  debug(context: string, message: string, data?: any) {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.log(`%c[DEBUG] %c[${context}]%c ${message}`, styles.debug, styles.component, styles.debug);
      if (data !== undefined) {
        console.log(`%c[DATA]`, styles.data, data);
      }
    }
  },

  info(context: string, message: string, data?: any) {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(`%c[INFO] %c[${context}]%c ${message}`, styles.info, styles.component, '');
      if (data !== undefined) {
        console.log(`%c[DATA]`, styles.data, data);
      }
    }
  },

  warn(context: string, message: string, data?: any) {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(`%c[WARN] %c[${context}]%c ${message}`, styles.warn, styles.component, '');
      if (data !== undefined) {
        console.log(`%c[DATA]`, styles.data, data);
      }
    }
  },

  error(context: string, message: string, error?: any) {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(`%c[ERROR] %c[${context}]%c ${message}`, styles.error, styles.component, '');
      if (error) {
        if (error instanceof Error) {
          console.error(`%c[ERROR DETAILS]`, styles.error, error.message);
          console.error(error.stack);
        } else {
          console.error(`%c[ERROR DETAILS]`, styles.error, error);
        }
      }
    }
  },

  // Logs específicos para componentes
  component: {
    render(componentName: string) {
      logger.debug(`Component`, `${componentName} renderizado`);
    },
    mount(componentName: string) {
      logger.debug(`Component`, `${componentName} montado`);
    },
    unmount(componentName: string) {
      logger.debug(`Component`, `${componentName} desmontado`);
    },
    update(componentName: string, prevProps?: any, nextProps?: any) {
      logger.debug(`Component`, `${componentName} actualizado`, { prevProps, nextProps });
    }
  },

  // Logs específicos para Redux
  redux: {
    action(type: string, payload?: any) {
      logger.debug(`Redux`, `Dispatching action: ${type}`, payload);
    },
    state(prevState: any, nextState: any) {
      logger.debug(`Redux`, `Estado actualizado`, { 
        prev: prevState, 
        next: nextState,
        diff: getDiff(prevState, nextState)
      });
    }
  },

  // Logs para API
  api: {
    request(method: string, url: string, body?: any) {
      logger.info(`API`, `${method} ${url}`, body);
    },
    response(method: string, url: string, status: number, data?: any) {
      if (status >= 400) {
        logger.error(`API`, `${method} ${url} respondió con estado ${status}`, data);
      } else {
        logger.info(`API`, `${method} ${url} respondió con estado ${status}`, data);
      }
    },
    error(method: string, url: string, error: any) {
      logger.error(`API`, `${method} ${url} falló`, error);
    }
  }
};

// Utilidad para mostrar diferencias entre objetos
function getDiff(obj1: any, obj2: any) {
  const result: Record<string, { prev: any, next: any }> = {};
  
  // Verificar propiedades en obj1
  Object.keys(obj1 || {}).forEach(key => {
    if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2?.[key])) {
      result[key] = { prev: obj1[key], next: obj2?.[key] };
    }
  });
  
  // Verificar nuevas propiedades en obj2
  Object.keys(obj2 || {}).forEach(key => {
    if (!(key in obj1) && obj2[key] !== undefined) {
      result[key] = { prev: undefined, next: obj2[key] };
    }
  });
  
  return result;
}

export default logger;