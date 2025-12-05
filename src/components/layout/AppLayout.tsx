import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import BottomNav from './BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '@/components/notifications/NotificationBell';
import { SuspensionChecker } from '@/components/suspension/SuspensionChecker';

interface AppLayoutProps {
  children: React.ReactNode;
}

// Componente Badge rettangolare per la categoria
const RankBadge: React.FC<{ position: number | null; category: string | null }> = ({ position, category }) => {
  if (!position || !category) return null;

  // Determina colori e testo in base alla categoria
  const getCategoryStyle = () => {
    switch (category.toLowerCase()) {
      case 'gold':
        return {
          bgColor: 'bg-yellow-600',
          shadowColor: 'shadow-[0_0_20px_rgba(202,138,4,0.7)]',
          label: 'GOLD',
        };
      case 'silver':
        return {
          bgColor: 'bg-gray-500',
          shadowColor: 'shadow-[0_0_20px_rgba(107,114,128,0.7)]',
          label: 'SILVER',
        };
      case 'bronze':
        return {
          bgColor: 'bg-orange-600',
          shadowColor: 'shadow-[0_0_20px_rgba(234,88,12,0.7)]',
          label: 'BRONZE',
        };
      default:
        return null;
    }
  };

  const style = getCategoryStyle();
  if (!style) return null;

  return (
    <div className={`
      px-3 py-1.5 rounded-lg
      ${style.bgColor}
      ${style.shadowColor}
      text-white font-bold text-xs uppercase tracking-wider
    `}>
      {style.label}
    </div>
  );
};

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [playerData, setPlayerData] = useState<{
    position: number | null;
    category: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }>({
    position: null,
    category: null,
    display_name: null,
    avatar_url: null,
  });

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('players')
        .select('live_rank_position, live_rank_category, display_name, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setPlayerData({
          position: data.live_rank_position,
          category: data.live_rank_category,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
        });
      }
    };

    fetchPlayerData();

    // Sottoscrizione ai cambiamenti in tempo reale
    const channel = supabase
      .channel('player-rank-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          setPlayerData({
            position: newData.live_rank_position,
            category: newData.live_rank_category,
            display_name: newData.display_name,
            avatar_url: newData.avatar_url,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <SuspensionChecker />

      <header className="h-16 border-b border-tennis-court/20 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between h-full px-6">
          {/* Avatar e nome a sinistra - cliccabile per andare al profilo */}
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-tennis-court rounded-full px-1 py-1 transition-all hover:scale-105"
          >
            <Avatar className="h-10 w-10 shadow-[0_0_15px_rgba(139,195,74,0.3)] border-2 border-tennis-court/20">
              {playerData.avatar_url ? (
                <AvatarImage src={playerData.avatar_url} alt={playerData.display_name || 'User'} />
              ) : (
                <AvatarFallback className="bg-tennis-court/10 text-tennis-court font-semibold">
                  {playerData.display_name
                    ? playerData.display_name
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : 'U'}
                </AvatarFallback>
              )}
            </Avatar>
            {playerData.display_name && (
              <span className="text-sm font-medium text-foreground hidden sm:block">
                {playerData.display_name}
              </span>
            )}
          </button>

          {/* Logo centrale */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-tennis-court">TENNIS RACE</h1>
          </div>

          {/* Notifiche e Coccarda a destra */}
          <div className="flex items-center gap-3">
            <NotificationBell />
            <RankBadge position={playerData.position} category={playerData.category} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Bottom Navigation - Mobile First */}
      <BottomNav />
    </div>
  );
};

export default AppLayout;
