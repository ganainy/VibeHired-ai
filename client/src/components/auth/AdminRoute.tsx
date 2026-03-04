// client/src/components/auth/AdminRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface AdminRouteProps {
  children: React.ReactElement;
}

/**
 * Restricts a route to admin and owner roles only.
 * Assumes it is always nested inside <ProtectedRoute> (auth already verified).
 * Unauthorized users are silently redirected to /dashboard.
 */
const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
        <div
          className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    );
  }

  if (user?.role !== 'admin' && user?.role !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default AdminRoute;
