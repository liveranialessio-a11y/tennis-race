import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Championships from './Championships';
import AppLayout from '@/components/layout/AppLayout';
import TennisLoadingAnimation from '@/components/TennisLoadingAnimation';

const Index = () => {
  const { user, loading, hasPlayer, checkingPlayerStatus } = useAuth();

  if (loading || checkingPlayerStatus) {
    return <TennisLoadingAnimation />;
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to pending registration if user doesn't have a player record
  if (hasPlayer === false) {
    return <Navigate to="/pending-registration" replace />;
  }

  return (
    <AppLayout>
      <Championships />
    </AppLayout>
  );
};

export default Index;
