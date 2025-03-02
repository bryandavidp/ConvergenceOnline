// src/utils/eventBus.ts
type EventHandler = (...args: any[]) => void;

class EventBus {
  private events: Record<string, EventHandler[]> = {};

  on(event: string, callback: EventHandler): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push(callback);
    
    // Retornar función para desuscribirse
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    };
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    
    this.events[event].forEach(callback => {
      callback(...args);
    });
  }

  off(event: string, callback?: EventHandler): void {
    if (!callback) {
      delete this.events[event];
      return;
    }
    
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }
}

export const eventBus = new EventBus();
