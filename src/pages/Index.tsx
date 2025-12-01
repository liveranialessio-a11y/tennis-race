import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import Championships from './Championships';
import AppLayout from '@/components/layout/AppLayout';
import TennisLoadingAnimation from '@/components/TennisLoadingAnimation';

const Index = () => {
  const { user, loading, hasPlayer, checkingPlayerStatus } = useAuth();

  console.log('📄 [DEBUG] Index render:', {
    userId: user?.id,
    loading,
    hasPlayer,
    checkingPlayerStatus
  });

  if (loading || checkingPlayerStatus) {
    console.log('⏳ [DEBUG] Index showing loading (loading=' + loading + ', checkingPlayerStatus=' + checkingPlayerStatus + ')');
    return <TennisLoadingAnimation />;
  }

  // Redirect to login if not authenticated
  if (!user) {
    console.log('🔒 [DEBUG] Index redirecting to /login - no user');
    return <Navigate to="/login" replace />;
  }

  // Redirect to pending registration if user doesn't have a player record
  if (hasPlayer === false) {
    console.log('📝 [DEBUG] Index redirecting to /pending-registration - hasPlayer=FALSE');
    return <Navigate to="/pending-registration" replace />;
  }

  console.log('✅ [DEBUG] Index rendering Championships - hasPlayer=' + hasPlayer);
  return (
    <AppLayout>
      <Championships />
    </AppLayout>
  );
};

export default Index;
