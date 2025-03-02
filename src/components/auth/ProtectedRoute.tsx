// src/components/auth/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../store";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
}) => {
  const { isAuthenticated, loading } = useSelector(
    (state: RootState) => state.auth
  );
  const location = useLocation();

  if (loading) {
    return <div className="loading-spinner">Cargando...</div>;
  }

  if (requireAuth && !isAuthenticated) {
    // Redirigir a login si se requiere autenticación y el usuario no está autenticado
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!requireAuth && isAuthenticated) {
    // Redirigir a home si no se requiere autenticación y el usuario ya está autenticado
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;