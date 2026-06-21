// src/services/websocket/socketService.ts
import { io, Socket } from 'socket.io-client';
import { eventBus } from '../../utils/eventBus';

class SocketService {
  private socket: Socket | null = null;
  private connected: boolean = false;
  
  connect() {
    if (this.connected) return;
    
    this.socket = io(import.meta.env.VITE_SOCKET_URL || '', {
      withCredentials: true
    });
    
    this.socket.on('connect', () => {
      this.connected = true;
      eventBus.emit('socket:connected');
    });
    
    this.socket.on('disconnect', () => {
      this.connected = false;
      eventBus.emit('socket:disconnected');
    });
    
    // Configurar eventos de chat
    this.socket.on('message', (message) => {
      eventBus.emit('chat:message', message);
    });
    
    this.socket.on('user:joined', (user) => {
      eventBus.emit('chat:userJoined', user);
    });
    
    this.socket.on('user:left', (user) => {
      eventBus.emit('chat:userLeft', user);
    });
    
    this.socket.on('users:list', (users) => {
      eventBus.emit('chat:usersList', users);
    });
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
  
  sendMessage(message: string) {
    if (this.socket && this.connected) {
      this.socket.emit('message', { text: message });
    }
  }
  
  isConnected() {
    return this.connected;
  }
  
  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }
  
  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketService = new SocketService();
