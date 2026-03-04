// client/src/components/auth/ProtectedRoute.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
  skipOnboardingCheck?: boolean; // set true for the /onboarding route itself
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, skipOnboardingCheck = false }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to onboarding if the user hasn't completed it yet
  if (!skipOnboardingCheck && user?.onboardingComplete === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

export default ProtectedRoute;

