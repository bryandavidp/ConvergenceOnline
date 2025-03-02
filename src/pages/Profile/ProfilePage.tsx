// src/pages/Profile/ProfilePage.tsx
import * as React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { fetchUserProfile } from '../../store/slices/userSlice';
import './ProfilePage.css';

const ProfilePage: React.FC = () => {
  const dispatch = useDispatch();
  const { user, loading, error } = useSelector((state: RootState) => state.user);

  React.useEffect(() => {
    dispatch(fetchUserProfile());
  }, [dispatch]);

  if (loading) return <div>Cargando perfil...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>No se encontró el perfil</div>;

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
