import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PlayerSuspension {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  is_active: boolean;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
}

export const useSuspension = () => {
  const { user } = useAuth();
  const [suspension, setSuspension] = useState<PlayerSuspension | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveSuspension = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_active_suspension', {
        p_user_id: user.id
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setSuspension(data[0] as unknown as PlayerSuspension);
      } else {
        setSuspension(null);
      }
    } catch (error) {
      console.error('Error fetching suspension:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSuspension = async (
    startDate: Date,
    endDate: Date,
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      const { data, error } = await supabase.rpc('create_player_suspension', {
        p_user_id: user.id,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_reason: reason
      });

      if (error) throw error;

      toast.success('Sospensione creata con successo');
      await fetchActiveSuspension();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating suspension:', error);
      const errorMessage = error.message || 'Errore durante la creazione della sospensione';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const removeSuspension = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'User not authenticated' };

    try {
      const { error } = await supabase.rpc('remove_player_suspension', {
        p_user_id: user.id
      });

      if (error) throw error;

      toast.success('Sospensione rimossa con successo');
      setSuspension(null);
      return { success: true };
    } catch (error: any) {
      console.error('Error removing suspension:', error);
      const errorMessage = error.message || 'Errore durante la rimozione della sospensione';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const extendSuspension = async (newEndDate: Date): Promise<{ success: boolean; error?: string }> => {
    if (!user || !suspension) return { success: false, error: 'No active suspension to extend' };

    try {
      // Update the suspension's end_date directly
      const { error } = await supabase
        .from('player_suspensions')
        .update({
          end_date: newEndDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', suspension.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Sospensione prolungata con successo');
      await fetchActiveSuspension();
      return { success: true };
    } catch (error: any) {
      console.error('Error extending suspension:', error);
      const errorMessage = error.message || 'Errore durante il prolungamento della sospensione';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  useEffect(() => {
    fetchActiveSuspension();
  }, [user]);

  return {
    suspension,
    loading,
    createSuspension,
    removeSuspension,
    extendSuspension,
    refreshSuspension: fetchActiveSuspension
  };
};
