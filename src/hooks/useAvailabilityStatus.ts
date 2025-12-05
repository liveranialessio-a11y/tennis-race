import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AvailabilityStatus = Database['public']['Enums']['availability_status_enum'];

export const useAvailabilityStatus = (userId: string | null | undefined) => {
  const [status, setStatus] = useState<AvailabilityStatus>('available');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('availability_status')
          .eq('user_id', userId)
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          setStatus(data[0].availability_status);
        }
      } catch (error) {
        console.error('Error fetching availability status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`player_status_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.new && 'availability_status' in payload.new) {
            setStatus(payload.new.availability_status as AvailabilityStatus);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { status, loading };
};

export const getStatusColor = (status: AvailabilityStatus): string => {
  switch (status) {
    case 'available':
      return 'green';
    case 'unavailable':
      return 'red';
    case 'suspended':
      return 'orange';
    default:
      return 'gray';
  }
};

export const getStatusLabel = (status: AvailabilityStatus): string => {
  switch (status) {
    case 'available':
      return 'Disponibile';
    case 'unavailable':
      return 'Non disponibile';
    case 'suspended':
      return 'Sospeso';
    default:
      return 'Sconosciuto';
  }
};
