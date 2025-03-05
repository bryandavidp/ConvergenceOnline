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
let currentLogLevel = LogLevel.NONE;

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
  section: string;
  divider: string;
  time: string;
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
  redux: 'color: #cc00cc; font-weight: bold',
  section: 'color: #333; background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-weight: bold',
  divider: 'color: #ccc; font-weight: normal',
  time: 'color: #666; font-weight: normal; font-style: italic'
};

// Colores para diferentes contextos
const contextColors: Record<string, string> = {
  'Component': '#9900cc',
  'Redux': '#cc00cc',
  'API': '#3366ff',
  'Game': '#009933',
  'Auth': '#ff6600',
  'Main': '#333333',
  'Store': '#3399ff',
  'Layout': '#663399',
  'useGameLogic': '#006633',
  'GameControls': '#990033',
  'GameBoard': '#336699',
  'ProfilePage': '#996633',
  'LoginPage': '#666633',
  'HomePage': '#663300',
  'UserSlice': '#6600cc',
  'GamePage': '#339966',
  'GameOverModal': '#cc3300',
  'LevelCompleteModal': '#33cc33',
  'StartGameModal': '#0066cc',
  'ErrorBoundary': '#cc0000'
};

// Secciones para agrupar logs
const sections: Record<string, string> = {
  'Component': '🧩 COMPONENTES',
  'Redux': '🔄 REDUX',
  'API': '🌐 API',
  'Game': '🎮 JUEGO',
  'Auth': '🔐 AUTENTICACIÓN',
  'Main': '🚀 APLICACIÓN',
  'Store': '📦 STORE',
  'Layout': '📏 LAYOUT',
  'useGameLogic': '🎲 LÓGICA DE JUEGO',
  'GameControls': '🎛️ CONTROLES',
  'GameBoard': '🎯 TABLERO',
  'ProfilePage': '👤 PERFIL',
  'LoginPage': '🔑 LOGIN',
  'HomePage': '🏠 INICIO',
  'UserSlice': '👤 USUARIO',
  'GamePage': '🎮 PÁGINA DE JUEGO',
  'GameOverModal': '🛑 FIN DE JUEGO',
  'LevelCompleteModal': '⭐ NIVEL COMPLETADO',
  'StartGameModal': '🏁 INICIO DE JUEGO',
  'ErrorBoundary': '⚠️ ERROR',
  'Logger': '📝 LOGGER'
};

// Último contexto utilizado para agrupar logs
let lastContext = '';
let lastSection = '';
let lastLogLevel = '';

// Función para imprimir un separador
const printSeparator = (context: string, logLevel: string) => {
  const section = getSection(context);
  
  // Cambio de sección
  if (section !== lastSection) {
    console.log('\n'); // Doble salto de línea
    console.log(`%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, styles.divider);
    console.log(`%c${section}`, styles.section);
    console.log(`%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, styles.divider);
    lastSection = section;
    lastContext = context;
    lastLogLevel = logLevel;
    return;
  }
  
  // Cambio de contexto dentro de la misma sección
  if (context !== lastContext || logLevel !== lastLogLevel) {
    console.log(`%c────────────────────────────────────────────────────────────────────────────────`, styles.divider);
    lastContext = context;
    lastLogLevel = logLevel;
  }
};

// Obtener la sección para un contexto
const getSection = (context: string): string => {
  // Extraer solo la parte principal del contexto (antes de cualquier separador)
  const mainContext = context.split('/')[0];
  return sections[mainContext] || `📋 ${mainContext.toUpperCase()}`;
};

// Obtener color para un contexto
const getContextColor = (context: string): string => {
  // Extraer solo la parte principal del contexto (antes de cualquier separador)
  const mainContext = context.split('/')[0];
  return contextColors[mainContext] || '#555555';
};

// Obtener timestamp formateado
const getTimestamp = (): string => {
  const now = new Date();
  return now.toISOString().slice(11, 23); // formato HH:MM:SS.sss
};

// Funciones principales de logging
const logger = {
  setLogLevel(level: LogLevel) {
    currentLogLevel = level;
    logger.info(`Logger`, `Nivel de log establecido a: ${LogLevel[level]}`);
  },

  debug(context: string, message: string, data?: any) {
    if (currentLogLevel <= LogLevel.DEBUG) {
      printSeparator(context, 'DEBUG');
      const timestamp = getTimestamp();
      const contextColor = `color: ${getContextColor(context)}; font-weight: bold`;
      
      console.log(
        `%c[${timestamp}] %c[DEBUG] %c[${context}]%c ${message}`, 
        styles.time, 
        styles.debug, 
        contextColor, 
        styles.debug
      );
      
      if (data !== undefined) {
        console.log(`%c[DATA]`, styles.data, data);
      }
    }
  },

  info(context: string, message: string, data?: any) {
    if (currentLogLevel <= LogLevel.INFO) {
      printSeparator(context, 'INFO');
      const timestamp = getTimestamp();
      const contextColor = `color: ${getContextColor(context)}; font-weight: bold`;
      
      console.log(
        `%c[${timestamp}] %c[INFO] %c[${context}]%c ${message}`, 
        styles.time, 
        styles.info, 
        contextColor, 
        ''
      );
      
      if (data !== undefined) {
        console.log(`%c[DATA]`, styles.data, data);
      }
    }
  },

  warn(context: string, message: string, data?: any) {
    if (currentLogLevel <= LogLevel.WARN) {
      printSeparator(context, 'WARN');
      const timestamp = getTimestamp();
      const contextColor = `color: ${getContextColor(context)}; font-weight: bold`;
      
      console.warn(
        `%c[${timestamp}] %c[WARN] %c[${context}]%c ${message}`, 
        styles.time, 
        styles.warn, 
        contextColor, 
        ''
      );
      
      if (data !== undefined) {
        console.log(`%c[DATA]`, styles.data, data);
      }
    }
  },

  error(context: string, message: string, error?: any) {
    if (currentLogLevel <= LogLevel.ERROR) {
      printSeparator(context, 'ERROR');
      const timestamp = getTimestamp();
      const contextColor = `color: ${getContextColor(context)}; font-weight: bold`;
      
      console.error(
        `%c[${timestamp}] %c[ERROR] %c[${context}]%c ${message}`, 
        styles.time, 
        styles.error, 
        contextColor, 
        ''
      );
      
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
      logger.debug(`Component/${componentName}`, `Renderizado`);
    },
    mount(componentName: string) {
      logger.debug(`Component/${componentName}`, `Montado`);
    },
    unmount(componentName: string) {
      logger.debug(`Component/${componentName}`, `Desmontado`);
    },
    update(componentName: string, prevProps?: any, nextProps?: any) {
      logger.debug(`Component/${componentName}`, `Actualizado`, { prevProps, nextProps });
    }
  },

  // Logs específicos para Redux
  redux: {
    action(type: string, payload?: any) {
      logger.debug(`Redux/Action`, `Dispatching action: ${type}`, payload);
    },
    state(prevState: any, nextState: any) {
      logger.debug(`Redux/State`, `Estado actualizado`, { 
        prev: prevState, 
        next: nextState,
        diff: getDiff(prevState, nextState)
      });
    }
  },

  // Logs para API
  api: {
    request(method: string, url: string, body?: any) {
      logger.info(`API/Request`, `${method} ${url}`, body);
    },
    response(method: string, url: string, status: number, data?: any) {
      if (status >= 400) {
        logger.error(`API/Response`, `${method} ${url} respondió con estado ${status}`, data);
      } else {
        logger.info(`API/Response`, `${method} ${url} respondió con estado ${status}`, data);
      }
    },
    error(method: string, url: string, error: any) {
      logger.error(`API/Error`, `${method} ${url} falló`, error);
    }
  },

  // Utilidad para logs de grupo
  group(context: string, title: string, collapsed = false) {
    const groupFunc = collapsed ? console.groupCollapsed : console.group;
    const contextColor = `color: ${getContextColor(context)}; font-weight: bold`;
    
    groupFunc(`%c[${context}] %c${title}`, contextColor, 'color: black; font-weight: normal');
    return {
      end: () => console.groupEnd()
    };
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