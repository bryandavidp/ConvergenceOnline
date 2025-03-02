// src/pages/Profile/ProfilePage.tsx
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchUserProfile } from '../../store/slices/userSlice';
import logger from '../../utils/logger';
import './ProfilePage.css';

const ProfilePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, loading, error } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    logger.component.mount('ProfilePage');
    logger.component.render('ProfilePage');
    logger.info('ProfilePage', 'Iniciando carga del perfil de usuario');
    
    dispatch(fetchUserProfile());
    
    return () => {
      logger.component.unmount('ProfilePage');
    };
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      logger.debug('ProfilePage', 'Datos del usuario cargados', user);
    }
  }, [user]);

  if (loading) {
    logger.debug('ProfilePage', 'Mostrando estado de carga');
    return <div className="loading-indicator">Cargando perfil...</div>;
  }
  
  if (error) {
    logger.error('ProfilePage', 'Error al cargar el perfil', error);
    return <div className="error-message">Error: {error}</div>;
  }
  
  if (!user) {
    logger.warn('ProfilePage', 'No se encontraron datos del usuario');
    return <div className="empty-state">No se encontró el perfil</div>;
  }

  return (
    <div className="profile-page">
      <h1>Perfil de {user.name}</h1>
      <div className="profile-info">
        <p>Email: {user.email}</p>
        <p>Puntuación máxima: {user.highScore}</p>
        <p>Nivel actual: {user.currentLevel}</p>
      </div>
    </div>
  );
};

export default ProfilePage;
