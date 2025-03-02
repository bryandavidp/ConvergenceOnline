import logger from './logger';

/**
 * Clase de utilidad para crear logs con contexto específico
 */
export class LogContext {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Crea un nuevo contexto anidado basado en este
   */
  subcontext(name: string): LogContext {
    return new LogContext(`${this.context}/${name}`);
  }

  /**
   * Logs de nivel DEBUG
   */
  debug(message: string, data?: any): void {
    logger.debug(this.context, message, data);
  }

  /**
   * Logs de nivel INFO
   */
  info(message: string, data?: any): void {
    logger.info(this.context, message, data);
  }

  /**
   * Logs de nivel WARN
   */
  warn(message: string, data?: any): void {
    logger.warn(this.context, message, data);
  }

  /**
   * Logs de nivel ERROR
   */
  error(message: string, error?: any): void {
    logger.error(this.context, message, error);
  }
  
  /**
   * Logs de componente
   */
  component = {
    render: () => logger.component.render(this.context),
    mount: () => logger.component.mount(this.context),
    unmount: () => logger.component.unmount(this.context),
    update: (prevProps?: any, nextProps?: any) => 
      logger.component.update(this.context, prevProps, nextProps)
  };

  /**
   * Crea un grupo de logs
   */
  group(title: string, collapsed = false) {
    return logger.group(this.context, title, collapsed);
  }

  /**
   * Crea un temporizador para medir duración de operaciones
   */
  timer(operation: string) {
    const startTime = performance.now();
    const timerLabel = `${this.context}:${operation}`;
    
    // Iniciar el timer
    console.time(timerLabel);
    
    // Registrar que se inició
    this.debug(`Iniciando operación: ${operation}`);
    
    // Función para finalizar y obtener resultados
    return {
      end: () => {
        const duration = performance.now() - startTime;
        console.timeEnd(timerLabel);
        this.debug(`Finalizada operación: ${operation}`, { 
          durationMs: duration,
          durationSec: (duration / 1000).toFixed(2)
        });
        return duration;
      }
    };
  }

  /**
   * Crea un log de transacción (inicio/fin de una operación larga)
   */
  transaction(operation: string) {
    const transactionId = Math.random().toString(36).substring(2, 10);
    this.info(`Iniciando transacción: ${operation}`, { transactionId });
    
    return {
      update: (status: string, data?: any) => {
        this.debug(`Actualización de transacción: ${operation} - ${status}`, { 
          ...data,
          transactionId 
        });
      },
      
      success: (message: string, data?: any) => {
        this.info(`Completada transacción: ${operation} - ${message}`, { 
          ...data,
          transactionId,
          status: 'success' 
        });
      },
      
      error: (message: string, error?: any) => {
        this.error(`Fallida transacción: ${operation} - ${message}`, { 
          error,
          transactionId,
          status: 'error' 
        });
      }
    };
  }

  /**
   * Log para el inicio de un flujo de usuario
   */
  userAction(action: string, details?: any) {
    this.info(`🧑‍💻 Acción de usuario: ${action}`, details);
  }

  /**
   * Log para eventos del ciclo de vida
   */
  lifecycle(event: string, details?: any) {
    this.debug(`🔄 Ciclo de vida: ${event}`, details);
  }
}

/**
 * Crea un contexto de logging con nombre específico
 */
export function createLogger(context: string): LogContext {
  return new LogContext(context);
}

/**
 * Decorador para medir el tiempo de ejecución de un método
 */
export function logTime(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    // Intentar obtener un logger del contexto del objeto o crear uno nuevo basado en el nombre de la clase
    const contextLogger = (this as any).logger || new LogContext(this.constructor?.name || 'Unknown');
    const timer = contextLogger.timer(propertyKey);
    try {
      const result = originalMethod.apply(this, args);
      if (result instanceof Promise) {
        return result.finally(() => timer.end());
      }
      timer.end();
      return result;
    } catch (error) {
      timer.end();
      throw error;
    }
  };
  
  return descriptor;
}

export default {
  createLogger,
  LogContext,
  logTime
}; 