// src/components/chat/ChatWindow.tsx
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { socketService } from '../../services/websocket/socketService';
import './ChatWindow.css';

const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    socketService.connect();
    socketService.on('message', (message: string) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (inputMessage.trim()) {
      socketService.sendMessage(inputMessage);
      setInputMessage('');
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className="message">{msg}</div>
        ))}
      </div>
      <input
        type="text"
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage}>Enviar</button>
    </div>
  );
};

export default ChatWindow;
