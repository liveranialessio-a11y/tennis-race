import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Championships from './Championships';
import AppLayout from '@/components/layout/AppLayout';
import TennisLoadingAnimation from '@/components/TennisLoadingAnimation';

const Index = () => {
  const { user, loading } = useAuth();
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [hasPlayer, setHasPlayer] = useState(false);

  useEffect(() => {
    const checkPlayerStatus = async () => {
      if (!user) {
        setCheckingStatus(false);
        return;
      }

      try {
        // Check if user has a player record
        const { data: playerData } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (playerData) {
          setHasPlayer(true);
        } else {
          // User doesn't have a player record, should see pending registration page
          setHasPlayer(false);
        }
      } catch (error) {
        console.error('Error checking player status:', error);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkPlayerStatus();
  }, [user]);

  if (loading || checkingStatus) {
    return <TennisLoadingAnimation />;
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to pending registration if user doesn't have a player record
  if (!hasPlayer) {
    return <Navigate to="/pending-registration" replace />;
  }

  return (
    <AppLayout>
      <Championships />
    </AppLayout>
  );
};

export default Index;
