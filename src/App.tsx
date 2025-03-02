import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { checkAuth } from './store/slices/authSlice';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpiner';

const HomePage = lazy(() => import('./pages/Home/HomePage'));
const GamePage = lazy(() => import('./pages/Game/GamePage'));
const LoginPage = lazy(() => import('./pages/Login/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Register/RegisterPage'));
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFound/NotFoundPage'));

const App: React.FC = () => {
  const dispatch = useDispatch();
  
  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);
  
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
