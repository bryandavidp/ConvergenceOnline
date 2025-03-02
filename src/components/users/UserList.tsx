// src/components/users/UserList.tsx
import React, { useEffect, useState } from 'react';
import { socketService } from '../../services/websocket/socketService';
import './UserList.css';

interface User {
  id: string;
  name: string;
}

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    socketService.on('users:list', (userList: User[]) => {
      setUsers(userList);
    });

    return () => {
      socketService.off('users:list');
    };
  }, []);

  return (
    <div className="user-list">
      <h3>Usuarios en línea</h3>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default UserList;
