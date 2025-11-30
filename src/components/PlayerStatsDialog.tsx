import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Phone, Award, TrendingUp, Medal, Target } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import TrophyCard from '@/components/TrophyCard';

interface Championship {
  id: string;
  name: string;
  gold_players_count: number;
  silver_players_count: number;
  bronze_players_count: number;
}

interface Player {
  id: string;
  user_id: string;
  display_name: string;
  phone: string | null;
  live_rank_position: number;
  live_rank_category: string | null;
  best_live_rank_category_position: number | null;
  best_category: string | null;
  pro_master_rank_position: number | null;
  best_pro_master_rank: number | null;
  pro_master_points: number;
  avatar_url: string | null;
  championship_id: string;
}

// Helper function per ottenere i colori della categoria
const getCategoryColor = (category: string | null) => {
  switch (category?.toLowerCase()) {
    case 'gold':
      return 'text-yellow-500';
    case 'silver':
      return 'text-gray-400';
    case 'bronze':
      return 'text-amber-700';
    default:
      return 'text-yellow-600';
  }
};

interface YearlyStats {
  year: string;
  wins: number;
  losses: number;
  draws: number;
  sets_won: number;
  sets_lost: number;
  games_won: number;
  games_lost: number;
}

interface PlayerTrophy {
  id: string;
  trophy_type: 'pro_master_rank' | 'live_rank' | 'tournament';
  position: number;
  tournament_title: string | null;
  awarded_date: string;
}

interface PlayerStatsDialogProps {
  playerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PlayerStatsDialog: React.FC<PlayerStatsDialogProps> = ({ playerId, open, onOpenChange }) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [championship, setChampionship] = useState<Championship | null>(null);
  const [yearlyStats, setYearlyStats] = useState<YearlyStats[]>([]);
  const [trophies, setTrophies] = useState<PlayerTrophy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTrophies, setLoadingTrophies] = useState(false);
  const [allTrophiesDialogOpen, setAllTrophiesDialogOpen] = useState(false);

  useEffect(() => {
    if (open && playerId) {
      fetchPlayerData();
    }
  }, [open, playerId]);

  const fetchPlayerData = async () => {
    if (!playerId) return;

    try {
      setLoading(true);

      // Fetch player data
      const { data: playerData, error: playerError } = await (supabase as any)
        .from('players')
        .select('*')
        .eq('user_id', playerId)
        .single();

      if (playerError) throw playerError;
      setPlayer(playerData);

      // Fetch championship data
      const { data: championshipData, error: championshipError } = await (supabase as any)
        .from('championships')
        .select('id, name, gold_players_count, silver_players_count, bronze_players_count')
        .eq('id', playerData.championship_id)
        .single();

      if (championshipError) throw championshipError;
      setChampionship(championshipData);

      // Fetch yearly stats for the last 2 years
      await fetchYearlyStats(playerData.user_id, playerData.championship_id);

      // Fetch trophies
      await fetchTrophies(playerData.id);
    } catch (error) {
      console.error('Errore nel caricamento dei dati del giocatore:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrophies = async (playerId: string) => {
    setLoadingTrophies(true);
    try {
      const { data, error } = await (supabase as any)
        .from('trophies')
        .select('*')
        .eq('player_id', playerId)
        .order('awarded_date', { ascending: false });

      if (error) throw error;

      setTrophies((data || []) as PlayerTrophy[]);
    } catch (error) {
      console.error('Error fetching trophies:', error);
    } finally {
      setLoadingTrophies(false);
    }
  };

  const fetchYearlyStats = async (userId: string, championshipId: string) => {
    try {
      // Get matches from the current year
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);

      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .eq('championship_id', championshipId)
        .eq('is_scheduled', false)
        .is('challenge_status', null)
        .gte('played_at', yearStart.toISOString())
        .or(`winner_id.eq.${userId},loser_id.eq.${userId}`)
        .order('played_at', { ascending: true });

      if (matchesError) throw matchesError;

      // Initialize current year data
      const yearlyData: { [key: string]: YearlyStats } = {};

      yearlyData[currentYear.toString()] = {
        year: currentYear.toString(),
        wins: 0,
        losses: 0,
        draws: 0,
        sets_won: 0,
        sets_lost: 0,
        games_won: 0,
        games_lost: 0,
      };

      // Process matches
      for (const match of matchesData || []) {
        const matchDate = new Date(match.played_at);
        const yearKey = matchDate.getFullYear().toString();

        if (yearlyData[yearKey]) {
          const isWinner = match.winner_id === userId;

          // Count wins/losses/draws
          if (match.is_draw) {
            yearlyData[yearKey].draws++;
          } else if (isWinner) {
            yearlyData[yearKey].wins++;
          } else {
            yearlyData[yearKey].losses++;
          }

          // Parse score to count sets and games
          // Format: "6-4 3-6 6-2" where each set is "winner_score-loser_score"
          // The winner of the match is already determined, but they can lose individual sets
          if (match.score) {
            const sets = match.score.split(' ').filter(s => s.includes('-'));
            for (const set of sets) {
              const [winnerScore, loserScore] = set.split('-').map(s => parseInt(s.trim()));
              if (!isNaN(winnerScore) && !isNaN(loserScore)) {
                // Determine who won this specific set (higher score wins the set)
                const matchWinnerWonThisSet = winnerScore > loserScore;

                if (isWinner) {
                  // I won the match
                  if (matchWinnerWonThisSet) {
                    yearlyData[yearKey].sets_won++;
                  } else {
                    yearlyData[yearKey].sets_lost++;
                  }
                  // Count games: if I won the match, winnerScore is my games, loserScore is opponent's games
                  yearlyData[yearKey].games_won += winnerScore;
                  yearlyData[yearKey].games_lost += loserScore;
                } else {
                  // I lost the match
                  if (matchWinnerWonThisSet) {
                    yearlyData[yearKey].sets_lost++;
                  } else {
                    yearlyData[yearKey].sets_won++;
                  }
                  // Count games: if I lost the match, loserScore is my games, winnerScore is opponent's games
                  yearlyData[yearKey].games_won += loserScore;
                  yearlyData[yearKey].games_lost += winnerScore;
                }
              }
            }
          }
        }
      }

      // Convert to array with only current year
      setYearlyStats([yearlyData[currentYear.toString()]]);
    } catch (error) {
      console.error('Errore nel caricamento delle statistiche annuali:', error);
      setYearlyStats([]);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0].charAt(0) + parts[1].charAt(0);
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Helper function to get category-relative position
  // Fixed category ranges: Gold (1-20), Silver (21-40), Bronze (41-60)
  const getCategoryPosition = (player: Player) => {
    if (!player.live_rank_position || !player.live_rank_category) {
      return player.live_rank_position || 0;
    }

    const { live_rank_position, live_rank_category } = player;

    switch (live_rank_category) {
      case 'gold':
        // Gold: positions 1-20, relative position is same as global
        return live_rank_position;
      case 'silver':
        // Silver: positions 21-40, relative position is global - 20
        return live_rank_position - 20;
      case 'bronze':
        // Bronze: positions 41-60, relative position is global - 40
        return live_rank_position - 40;
      default:
        return live_rank_position;
    }
  };

  // Helper function to get best live rank with category
  const getBestLiveRank = (player: Player) => {
    if (!player.best_live_rank_category_position || !player.best_category) {
      return {
        position: null,
        isCurrent: false,
      };
    }

    // Check if this is their current position (same category and same position)
    const currentCategoryPosition = getCategoryPosition(player);
    const isCurrent = player.live_rank_category === player.best_category &&
                     currentCategoryPosition === player.best_live_rank_category_position;

    return {
      position: player.best_live_rank_category_position,
      isCurrent,
    };
  };

  // Prepare chart data
  const matchesChartData = yearlyStats.map(stat => ({
    year: stat.year,
    Vinte: stat.wins,
    Perse: stat.losses,
  }));

  const setsChartData = yearlyStats.map(stat => ({
    year: stat.year,
    Vinti: stat.sets_won,
    Persi: stat.sets_lost,
  }));

  const gamesChartData = yearlyStats.map(stat => ({
    year: stat.year,
    Vinti: stat.games_won,
    Persi: stat.games_lost,
  }));

  if (!player && !loading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : player ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl text-tennis-court">Profilo Giocatore</DialogTitle>
              <DialogDescription className="sr-only">
                Statistiche e dettagli del giocatore {player.display_name}
              </DialogDescription>
            </DialogHeader>

            {/* Player Header */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-muted/30 rounded-lg">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 shadow-[0_0_20px_rgba(139,195,74,0.4)]">
                {player.avatar_url ? (
                  <AvatarImage src={player.avatar_url} alt={player.display_name} />
                ) : (
                  <AvatarFallback className="bg-tennis-court/10 text-tennis-court text-2xl">
                    {getInitials(player.display_name)}
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="flex-1 space-y-2 text-center sm:text-left w-full">
                <h2 className="text-xl sm:text-2xl font-bold break-words">{player.display_name}</h2>

                {player.phone && (
                  <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 sm:gap-3 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span className="text-sm">{player.phone}</span>
                    </div>
                    <a
                      href={`https://wa.me/${player.phone.startsWith('+') ? player.phone.replace(/[^\d+]/g, '') : player.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors text-xs font-medium"
                    >
                      <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Rankings Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Posizione Live - con colori dinamici basati su live_rank_category */}
              <div className={`p-4 rounded-xl border-2 ${
                player.live_rank_category === 'gold'
                  ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30 border-yellow-600 dark:border-yellow-600'
                  : player.live_rank_category === 'silver'
                  ? 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/30 border-gray-500 dark:border-gray-500'
                  : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-600 dark:border-orange-600'
              }`}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                  player.live_rank_category === 'gold'
                    ? 'text-yellow-900 dark:text-yellow-100'
                    : player.live_rank_category === 'silver'
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-orange-900 dark:text-orange-100'
                }`}>Posizione Live</p>
                <p className={`text-4xl font-black ${
                  player.live_rank_category === 'gold'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : player.live_rank_category === 'silver'
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-orange-600 dark:text-orange-500'
                }`}>{getCategoryPosition(player)}°</p>
              </div>

              {/* Categoria Attuale */}
              <div className={`p-4 rounded-xl border-2 ${
                player.live_rank_category === 'gold'
                  ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30 border-yellow-600 dark:border-yellow-600'
                  : player.live_rank_category === 'silver'
                  ? 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/30 border-gray-500 dark:border-gray-500'
                  : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-600 dark:border-orange-600'
              }`}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                  player.live_rank_category === 'gold'
                    ? 'text-yellow-900 dark:text-yellow-100'
                    : player.live_rank_category === 'silver'
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-orange-900 dark:text-orange-100'
                }`}>Categoria Attuale</p>
                <p className={`text-4xl font-black uppercase ${
                  player.live_rank_category === 'gold'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : player.live_rank_category === 'silver'
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-orange-600 dark:text-orange-500'
                }`}>{player.live_rank_category || '-'}</p>
              </div>

              {/* Miglior Rank Live - con colori dinamici basati su best_category */}
              <div className={`p-4 rounded-xl border-2 ${
                player.best_category === 'gold'
                  ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30 border-yellow-600 dark:border-yellow-600'
                  : player.best_category === 'silver'
                  ? 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/30 border-gray-500 dark:border-gray-500'
                  : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-600 dark:border-orange-600'
              }`}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                  player.best_category === 'gold'
                    ? 'text-yellow-900 dark:text-yellow-100'
                    : player.best_category === 'silver'
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-orange-900 dark:text-orange-100'
                }`}>Miglior Rank Live</p>
                <p className={`text-4xl font-black ${
                  player.best_category === 'gold'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : player.best_category === 'silver'
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-orange-600 dark:text-orange-500'
                }`}>
                  {(() => {
                    const bestRank = getBestLiveRank(player);
                    if (bestRank.isCurrent) {
                      return 'MR';
                    } else if (bestRank.position) {
                      return `${bestRank.position}°`;
                    } else {
                      return '-';
                    }
                  })()}
                </p>
              </div>

              {/* Miglior Categoria */}
              <div className={`p-4 rounded-xl border-2 ${
                player.best_category === 'gold'
                  ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30 border-yellow-600 dark:border-yellow-600'
                  : player.best_category === 'silver'
                  ? 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/30 border-gray-500 dark:border-gray-500'
                  : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-600 dark:border-orange-600'
              }`}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                  player.best_category === 'gold'
                    ? 'text-yellow-900 dark:text-yellow-100'
                    : player.best_category === 'silver'
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-orange-900 dark:text-orange-100'
                }`}>Miglior Categoria</p>
                <p className={`text-4xl font-black uppercase ${
                  player.best_category === 'gold'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : player.best_category === 'silver'
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-orange-600 dark:text-orange-500'
                }`}>{player.best_category || 'Bronze'}</p>
              </div>

              {/* Posizione Pro Master */}
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl border-2 border-green-200 dark:border-green-800">
                <p className="text-xs font-semibold text-green-900 dark:text-green-100 uppercase tracking-wider mb-1">Posizione Pro Master</p>
                <p className="text-4xl font-black text-green-600 dark:text-green-400">{player.pro_master_rank_position ? `${player.pro_master_rank_position}°` : '-'}</p>
              </div>

              {/* Miglior Rank Pro Master */}
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl border-2 border-green-200 dark:border-green-800">
                <p className="text-xs font-semibold text-green-900 dark:text-green-100 uppercase tracking-wider mb-1">Miglior Rank Pro Master</p>
                <p className="text-4xl font-black text-green-600 dark:text-green-400">
                  {(() => {
                    const isBestProMaster = player.pro_master_rank_position === player.best_pro_master_rank;
                    if (isBestProMaster) {
                      return 'MR';
                    } else if (player.best_pro_master_rank) {
                      return `${player.best_pro_master_rank}°`;
                    } else {
                      return '-';
                    }
                  })()}
                </p>
              </div>
            </div>

            {/* Bacheca Trofei */}
            <Card className="border-tennis-court/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-tennis-court">
                  <Award className="h-5 w-5" />
                  Bacheca Trofei
                </CardTitle>
                <CardDescription>
                  Riconoscimenti e trofei conquistati
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTrophies ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="h-8 w-8 border-4 border-tennis-court border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : trophies.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {trophies.slice(0, 3).map((trophy) => (
                        <TrophyCard
                          key={trophy.id}
                          trophyType={trophy.trophy_type}
                          position={trophy.position}
                          tournamentTitle={trophy.tournament_title}
                          awardedDate={trophy.awarded_date}
                        />
                      ))}
                    </div>
                    {trophies.length > 3 && (
                      <Button
                        onClick={() => setAllTrophiesDialogOpen(true)}
                        variant="outline"
                        className="w-full"
                      >
                        <Award className="h-4 w-4 mr-2" />
                        Visualizza tutti i trofei ({trophies.length})
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Award className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Nessun trofeo ancora conquistato
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 gap-6">
              {/* Matches Chart - Current Year */}
              <Card>
                <CardContent className="pt-6">
                  {(() => {
                    const stats = yearlyStats[0] || { wins: 0, losses: 0, draws: 0 };
                    const total = stats.wins + stats.losses + stats.draws;
                    const winPercentage = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
                    const pieData = [
                      { name: 'Vinte', value: stats.wins, color: '#22c55e' },
                      { name: 'Perse', value: stats.losses, color: '#ef4444' },
                      { name: 'Pareggi', value: stats.draws, color: '#9ca3af' },
                    ].filter(d => d.value > 0);

                    return (
                      <>
                        <div className="text-center mb-2">
                          <p className="text-3xl font-bold text-tennis-court">{total}</p>
                          <p className="text-sm text-muted-foreground uppercase">Partite</p>
                        </div>
                        <div className="relative h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <p className="text-3xl font-bold text-tennis-court">{winPercentage}%</p>
                              <p className="text-xs text-muted-foreground">Vittorie</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-4 text-center text-sm">
                          <div>
                            <p className="font-bold text-green-600">{stats.wins}</p>
                            <p className="text-xs text-muted-foreground">Vinte</p>
                          </div>
                          <div>
                            <p className="font-bold text-red-600">{stats.losses}</p>
                            <p className="text-xs text-muted-foreground">Perse</p>
                          </div>
                          <div>
                            <p className="font-bold text-gray-500">{stats.draws}</p>
                            <p className="text-xs text-muted-foreground">Pareggi</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Sets Chart - Current Year */}
              <Card>
                <CardContent className="pt-6">
                  {(() => {
                    const stats = yearlyStats[0] || { sets_won: 0, sets_lost: 0 };
                    const total = stats.sets_won + stats.sets_lost;
                    const winPercentage = total > 0 ? Math.round((stats.sets_won / total) * 100) : 0;
                    const pieData = [
                      { name: 'Vinti', value: stats.sets_won, color: '#22c55e' },
                      { name: 'Persi', value: stats.sets_lost, color: '#ef4444' },
                    ].filter(d => d.value > 0);

                    return (
                      <>
                        <div className="text-center mb-2">
                          <p className="text-3xl font-bold text-tennis-court">{total}</p>
                          <p className="text-sm text-muted-foreground uppercase">Set</p>
                        </div>
                        <div className="relative h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <p className="text-3xl font-bold text-tennis-court">{winPercentage}%</p>
                              <p className="text-xs text-muted-foreground">Vittorie</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-4 text-center text-sm">
                          <div>
                            <p className="font-bold text-green-600">{stats.sets_won}</p>
                            <p className="text-xs text-muted-foreground">Vinti</p>
                          </div>
                          <div>
                            <p className="font-bold text-red-600">{stats.sets_lost}</p>
                            <p className="text-xs text-muted-foreground">Persi</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Games Chart - Current Year */}
              <Card>
                <CardContent className="pt-6">
                  {(() => {
                    const stats = yearlyStats[0] || { games_won: 0, games_lost: 0 };
                    const total = stats.games_won + stats.games_lost;
                    const winPercentage = total > 0 ? Math.round((stats.games_won / total) * 100) : 0;
                    const pieData = [
                      { name: 'Vinti', value: stats.games_won, color: '#22c55e' },
                      { name: 'Persi', value: stats.games_lost, color: '#ef4444' },
                    ].filter(d => d.value > 0);

                    return (
                      <>
                        <div className="text-center mb-2">
                          <p className="text-3xl font-bold text-tennis-court">{total}</p>
                          <p className="text-sm text-muted-foreground uppercase">Games</p>
                        </div>
                        <div className="relative h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <p className="text-3xl font-bold text-tennis-court">{winPercentage}%</p>
                              <p className="text-xs text-muted-foreground">Vittorie</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-4 text-center text-sm">
                          <div>
                            <p className="font-bold text-green-600">{stats.games_won}</p>
                            <p className="text-xs text-muted-foreground">Vinti</p>
                          </div>
                          <div>
                            <p className="font-bold text-red-600">{stats.games_lost}</p>
                            <p className="text-xs text-muted-foreground">Persi</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </DialogContent>

      {/* All Trophies Dialog */}
      <Dialog open={allTrophiesDialogOpen} onOpenChange={setAllTrophiesDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-tennis-court" />
              Tutti i Trofei
            </DialogTitle>
            <DialogDescription>
              La collezione completa di trofei, organizzata per anno
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {(() => {
              // Group trophies by year
              const trophiesByYear = trophies.reduce((acc, trophy) => {
                const year = new Date(trophy.awarded_date).getFullYear();
                if (!acc[year]) {
                  acc[year] = [];
                }
                acc[year].push(trophy);
                return acc;
              }, {} as Record<number, PlayerTrophy[]>);

              // Sort years in descending order
              const sortedYears = Object.keys(trophiesByYear)
                .map(Number)
                .sort((a, b) => b - a);

              return sortedYears.map((year) => (
                <div key={year} className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <h3 className="text-xl font-bold text-tennis-court">{year}</h3>
                    <span className="text-sm text-muted-foreground">
                      ({trophiesByYear[year].length} {trophiesByYear[year].length === 1 ? 'trofeo' : 'trofei'})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {trophiesByYear[year].map((trophy) => (
                      <TrophyCard
                        key={trophy.id}
                        trophyType={trophy.trophy_type}
                        position={trophy.position}
                        tournamentTitle={trophy.tournament_title}
                        awardedDate={trophy.awarded_date}
                      />
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default PlayerStatsDialog;
