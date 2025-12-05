import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, ArrowRight, Calendar, TrendingUp, TrendingDown, History, Clock, Award, Medal, Circle, Swords, Download, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import PlayerStatsDialog from '@/components/PlayerStatsDialog';
import { SuspensionReasonDialog } from '@/components/suspension/SuspensionReasonDialog';
import type { Database } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Player {
  id: string;
  user_id: string;
  display_name: string;
  wins: number;
  losses: number;
  draws: number;
  matches_played: number;
  avatar_url: string | null;
  live_rank_position: number | null;
  live_rank_category: string | null;
  previous_live_rank_position: number | null;
  pro_master_points: number;
  pro_master_rank_position: number | null;
  best_pro_master_rank: number | null;
  matches_this_month: number;
  best_live_rank_category_position: number | null;
  best_category: string | null;
  best_position_in_gold: number | null;
  best_position_in_silver: number | null;
  best_position_in_bronze: number | null;
  availability_status?: Database['public']['Enums']['availability_status_enum'];
  suspension?: {
    start_date: string;
    end_date: string;
    reason: string;
  } | null;
}

interface PlayerWithStats extends Player {
  yearlyMatches: number;
  yearlyWins: number;
  yearlyLosses: number;
  yearlyDraws: number;
  isChallengeable?: boolean;
}

interface Match {
  id: string;
  winner_id: string;
  loser_id: string;
  score: string;
  played_at: string;
  is_validated: boolean;
  reported_by: string;
}

interface Championship {
  id: string;
  name: string;
  enable_set_bonus: boolean;
  gold_players_count: number;
  silver_players_count: number;
  bronze_players_count: number;
}

const Championships: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [championship, setChampionship] = useState<Championship | null>(null);
  const [topLivePlayers, setTopLivePlayers] = useState<Player[]>([]);
  const [topProMasterPlayers, setTopProMasterPlayers] = useState<Player[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFullLiveRanking, setShowFullLiveRanking] = useState(false);
  const [showFullProMasterRanking, setShowFullProMasterRanking] = useState(false);
  const [showAllScheduled, setShowAllScheduled] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [weekView, setWeekView] = useState(false);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [allScheduledMatches, setAllScheduledMatches] = useState<Match[]>([]);
  const [allPlayedMatches, setAllPlayedMatches] = useState<Match[]>([]);
  const [playersWithStats, setPlayersWithStats] = useState<PlayerWithStats[]>([]);
  
  // Player Stats Dialog
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showPlayerDialog, setShowPlayerDialog] = useState(false);

  // Challenge Modal
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengedPlayer, setChallengedPlayer] = useState<PlayerWithStats | null>(null);
  const [isLaunchingChallenge, setIsLaunchingChallenge] = useState(false);

  // Suspension Dialog
  const [showSuspensionDialog, setShowSuspensionDialog] = useState(false);
  const [selectedSuspendedPlayer, setSelectedSuspendedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    console.log('🔄 Suspension dialog state changed:', {
      showSuspensionDialog,
      selectedSuspendedPlayer: selectedSuspendedPlayer?.display_name,
      hasSuspension: !!selectedSuspendedPlayer?.suspension
    });
  }, [showSuspensionDialog, selectedSuspendedPlayer]);

  const handlePlayerClick = (userId: string) => {
    setSelectedPlayerId(userId);
    setShowPlayerDialog(true);
  };

  const handleChallengeClick = (player: PlayerWithStats) => {
    setChallengedPlayer(player);
    setShowChallengeModal(true);
  };

  const handleSuspensionClick = (player: Player) => {
    console.log('🔍 Clicked suspended player:', player);
    console.log('🔍 Suspension data:', player.suspension);
    setSelectedSuspendedPlayer(player);
    setShowSuspensionDialog(true);
    console.log('✅ Dialog state set to true');
  };

  const handleLaunchChallenge = async () => {
    if (!challengedPlayer || !user || !championship) return;

    setIsLaunchingChallenge(true);

    try {
      // Call the launch_challenge function
      const { data, error } = await supabase.rpc('launch_challenge', {
        p_challenger_id: user.id,
        p_challenged_id: challengedPlayer.user_id,
        p_championship_id: championship.id,
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: 'Errore',
          description: data.error || 'Impossibile lanciare la sfida',
          variant: 'destructive',
        });
        return;
      }

      // Send challenge email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-challenge-email', {
        body: {
          challengeId: data.match_id,
          type: 'challenge_created',
          challengerId: user.id,
          challengedId: challengedPlayer.user_id,
        },
      });

      if (emailError) {
        console.error('Error sending challenge email:', emailError);
      }

      toast({
        title: 'Sfida lanciata!',
        description: `Hai sfidato ${challengedPlayer.display_name}. Riceverà una notifica via email.`,
      });

      setShowChallengeModal(false);
      setChallengedPlayer(null);

      // Reload the ranking to update challengeable status
      await loadFullLiveRanking();
    } catch (error) {
      console.error('Error launching challenge:', error);
      toast({
        title: 'Errore',
        description: 'Si è verificato un errore durante il lancio della sfida',
        variant: 'destructive',
      });
    } finally {
      setIsLaunchingChallenge(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Scroll to top when opening expanded views
  useEffect(() => {
    if (showAllScheduled || showAllResults || showFullLiveRanking || showFullProMasterRanking) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showAllScheduled, showAllResults, showFullLiveRanking, showFullProMasterRanking]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch the first (and only) championship
      const { data: championshipData } = await supabase
        .from('championships')
        .select('*')
        .limit(1)
        .single();

      if (championshipData) {
        setChampionship(championshipData);

        // Fetch ALL players (for name resolution)
        const { data: allPlayersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('championship_id', championshipData.id)
          .order('live_rank_position', { ascending: true, nullsFirst: false });

        if (playersError) console.error('❌ Error loading players:', playersError);

        // Fetch active suspensions
        const { data: suspensionsData } = await supabase
          .from('player_suspensions')
          .select('user_id, start_date, end_date, reason')
          .eq('is_active', true);

        // Map suspensions by user_id
        const suspensionsMap = new Map(
          (suspensionsData || []).map(s => [s.user_id, {
            start_date: s.start_date,
            end_date: s.end_date,
            reason: s.reason
          }])
        );

        // Add suspension data to players
        const playersWithSuspensions = (allPlayersData || []).map(player => ({
          ...player,
          suspension: suspensionsMap.get(player.user_id) || null
        }));

        setAllPlayers(playersWithSuspensions);

        // Fetch top 3 players from each category for Live Ranking
        const { data: allLivePlayersData } = await supabase
          .from('players')
          .select('*')
          .eq('championship_id', championshipData.id)
          .not('live_rank_position', 'is', null)
          .order('live_rank_position', { ascending: true });

        // Add suspension data to live players
        const livePlayersWithSuspensions = (allLivePlayersData || []).map(player => ({
          ...player,
          suspension: suspensionsMap.get(player.user_id) || null
        }));

        // Filter top 3 from each category
        const goldTop3 = livePlayersWithSuspensions
          .filter(p => p.live_rank_category === 'gold')
          .slice(0, 3);
        const silverTop3 = livePlayersWithSuspensions
          .filter(p => p.live_rank_category === 'silver')
          .slice(0, 3);
        const bronzeTop3 = livePlayersWithSuspensions
          .filter(p => p.live_rank_category === 'bronze')
          .slice(0, 3);

        // Combine and sort by position
        const top3PerCategory = [...goldTop3, ...silverTop3, ...bronzeTop3]
          .sort((a, b) => (a.live_rank_position || 0) - (b.live_rank_position || 0));

        setTopLivePlayers(top3PerCategory);

        // Fetch top 3 players for Pro Master Ranking
        // Order by points DESC, then by display_name ASC (same as backend function)
        const { data: proMasterData } = await supabase
          .from('players')
          .select('*')
          .eq('championship_id', championshipData.id)
          .order('pro_master_points', { ascending: false })
          .order('display_name', { ascending: true })
          .limit(3);

        // Add suspension data to pro master players
        const proMasterWithSuspensions = (proMasterData || []).map(player => ({
          ...player,
          suspension: suspensionsMap.get(player.user_id) || null
        }));

        setTopProMasterPlayers(proMasterWithSuspensions);

        // Fetch next 3 upcoming scheduled matches
        const now = new Date().toISOString();
        const { data: matchesData } = await supabase
          .from('matches')
          .select('*')
          .eq('championship_id', championshipData.id)
          .eq('is_scheduled', true)
          .gte('played_at', now)
          .order('played_at', { ascending: true })
          .limit(3);

        setUpcomingMatches(matchesData || []);

        // Fetch last 3 played matches (scheduled = false, challenge_status = null)
        const { data: recentMatchesData } = await supabase
          .from('matches')
          .select('*')
          .eq('championship_id', championshipData.id)
          .eq('is_scheduled', false)
          .is('challenge_status', null)
          .order('played_at', { ascending: false })
          .limit(3);
        setRecentMatches(recentMatchesData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i dati',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAllScheduled = async () => {
    if (!championship) return;

    try {
      const now = new Date().toISOString();
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .eq('championship_id', championship.id)
        .eq('is_scheduled', true)
        .gte('played_at', now)
        .order('played_at', { ascending: true });

      setAllScheduledMatches(matchesData || []);
      setSelectedDay(null);
      setWeekView(false);
      setShowAllScheduled(true);
    } catch (error) {
      console.error('Error loading scheduled matches:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare le partite programmate',
        variant: 'destructive',
      });
    }
  };

  const loadAllResults = async () => {
    if (!championship) return;

    try {
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .eq('championship_id', championship.id)
        .eq('is_scheduled', false)
        .is('challenge_status', null)
        .order('played_at', { ascending: false });

      setAllPlayedMatches(matchesData || []);
      setSelectedDay(null);
      setWeekView(false);
      setShowAllResults(true);
    } catch (error) {
      console.error('Error loading results:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i risultati',
        variant: 'destructive',
      });
    }
  };

  const getNextWeekDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const filterMatchesByDay = (matches: Match[], day: Date | null) => {
    if (!day) return matches;
    return matches.filter(match => {
      const matchDate = new Date(match.played_at);
      return isSameDay(matchDate, day);
    });
  };

  const groupMatchesByDay = (matches: Match[]) => {
    const grouped: { [key: string]: Match[] } = {};
    matches.forEach(match => {
      const matchDate = new Date(match.played_at);
      const dateKey = format(matchDate, 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(match);
    });
    return grouped;
  };

  const downloadWeeklyReport = () => {
    if (!championship || allScheduledMatches.length === 0) {
      toast({
        title: 'Nessuna partita',
        description: 'Non ci sono partite programmate da esportare',
        variant: 'destructive',
      });
      return;
    }

    // Raggruppa le partite per giorno
    const grouped = groupMatchesByDay(allScheduledMatches);
    const sortedDates = Object.keys(grouped).sort();

    // Genera il contenuto del report
    let reportContent = `╔════════════════════════════════════════════════╗\n`;
    reportContent += `║  PARTITE PROGRAMMATE - ${championship.name.toUpperCase()}\n`;
    reportContent += `╚════════════════════════════════════════════════╝\n\n`;
    reportContent += `📅 Report generato il: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })}\n`;
    reportContent += `🎾 Totale partite: ${allScheduledMatches.length}\n\n`;
    reportContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    sortedDates.forEach(dateKey => {
      const dayMatches = grouped[dateKey];
      const dayDate = new Date(dateKey);

      reportContent += `📆 ${format(dayDate, 'EEEE d MMMM yyyy', { locale: it }).toUpperCase()}\n`;
      reportContent += `   (${dayMatches.length} ${dayMatches.length === 1 ? 'partita' : 'partite'})\n`;
      reportContent += `${'─'.repeat(48)}\n\n`;

      dayMatches.forEach((match, index) => {
        const player1 = getPlayerName(match.winner_id);
        const player2 = getPlayerName(match.loser_id);
        const matchTime = format(new Date(match.played_at), 'HH:mm');

        reportContent += `   ${index + 1}. 🕒 ${matchTime}\n`;
        reportContent += `      🎾 ${player1}\n`;
        reportContent += `         VS\n`;
        reportContent += `      🎾 ${player2}\n\n`;
      });

      reportContent += `\n`;
    });

    reportContent += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Crea il file e scaricalo
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `partite_programmate_${format(new Date(), 'yyyy-MM-dd_HHmm')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Report scaricato',
      description: `File con ${allScheduledMatches.length} partite programmate`,
    });
  };

  const loadFullLiveRanking = async () => {
    if (!championship) return;

    try {
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('championship_id', championship.id)
        .not('live_rank_position', 'is', null)
        .order('live_rank_position', { ascending: true });

      // Fetch active suspensions
      const { data: suspensionsData, error: suspensionsError } = await supabase
        .from('player_suspensions')
        .select('user_id, start_date, end_date, reason')
        .eq('is_active', true);

      if (suspensionsError) {
        console.error('❌ Error loading suspensions:', suspensionsError);
      }

      console.log('📋 Loaded suspensions in loadFullLiveRanking:', suspensionsData);

      // Map suspensions by user_id
      const suspensionsMap = new Map(
        (suspensionsData || []).map(s => [s.user_id, {
          start_date: s.start_date,
          end_date: s.end_date,
          reason: s.reason
        }])
      );

      console.log('🗺️ Suspensions map:', suspensionsMap);

      // Add suspension data to players
      const playersWithSuspensions = (playersData || []).map(player => ({
        ...player,
        suspension: suspensionsMap.get(player.user_id) || null
      }));

      console.log('👥 Players with suspensions:', playersWithSuspensions.filter(p => p.suspension));

      setAllPlayers(playersWithSuspensions);

      // Calcola statistiche mensili e annuali per ogni giocatore
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const monthStart = new Date(currentYear, currentMonth, 1);
      const yearStart = new Date(currentYear, 0, 1);

      // Fetch tutte le partite dell'anno (solo partite completate)
      const { data: yearMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('championship_id', championship.id)
        .eq('is_scheduled', false)
        .is('challenge_status', null)
        .gte('played_at', yearStart.toISOString());

      // Calcola stats per ogni giocatore
      const statsMap = new Map<string, { yearlyMatches: number; yearlyWins: number; yearlyLosses: number; yearlyDraws: number }>();

      for (const player of playersData || []) {
        let yearlyMatches = 0;
        let yearlyWins = 0;
        let yearlyLosses = 0;
        let yearlyDraws = 0;

        for (const match of yearMatches || []) {
          const isInvolved = match.winner_id === player.user_id || match.loser_id === player.user_id;

          if (isInvolved) {
            yearlyMatches++;

            // Conta vittorie/sconfitte/pareggi annuali
            if (match.is_draw) {
              yearlyDraws++;
            } else if (match.winner_id === player.user_id) {
              yearlyWins++;
            } else {
              yearlyLosses++;
            }
          }
        }

        statsMap.set(player.user_id, { yearlyMatches, yearlyWins, yearlyLosses, yearlyDraws });
      }

      // Check challengeable status for each player
      const challengeableChecks = await Promise.all(
        (playersData || []).map(async (player) => {
          const { data, error } = await supabase.rpc('is_player_challengeable', {
            p_user_id: player.user_id,
            p_championship_id: championship.id,
          });

          if (error) {
            console.error('Error checking challengeable status:', error);
            return false;
          }

          return data === true;
        })
      );

      // Combina players con stats, challengeable status e suspension data
      const playersWithStatsData: PlayerWithStats[] = (playersData || []).map((player, index) => ({
        ...player,
        yearlyMatches: statsMap.get(player.user_id)?.yearlyMatches || 0,
        yearlyWins: statsMap.get(player.user_id)?.yearlyWins || 0,
        yearlyLosses: statsMap.get(player.user_id)?.yearlyLosses || 0,
        yearlyDraws: statsMap.get(player.user_id)?.yearlyDraws || 0,
        isChallengeable: challengeableChecks[index],
        suspension: suspensionsMap.get(player.user_id) || null,
      }));

      setPlayersWithStats(playersWithStatsData);
      setShowFullLiveRanking(true);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error loading full live ranking:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare la classifica live completa',
        variant: 'destructive',
      });
    }
  };

  const loadFullProMasterRanking = async () => {
    if (!championship) return;

    try {
      // Order by points DESC, then by display_name ASC (same as backend)
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('championship_id', championship.id)
        .order('pro_master_points', { ascending: false })
        .order('display_name', { ascending: true });

      setAllPlayers(playersData || []);
      setShowFullProMasterRanking(true);
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error loading full pro master ranking:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare la classifica pro master completa',
        variant: 'destructive',
      });
    }
  };

  const getCategoryBadgeVariant = (category: string | null) => {
    switch (category) {
      case 'gold':
        return 'default';
      case 'silver':
        return 'secondary';
      case 'bronze':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case 'gold':
        return 'text-yellow-600';
      case 'silver':
        return 'text-gray-400';
      case 'bronze':
        return 'text-orange-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getCategoryBgColor = (category: string | null) => {
    switch (category) {
      case 'gold':
        return 'bg-yellow-600/10 border-yellow-600/20';
      case 'silver':
        return 'bg-gray-400/10 border-gray-400/20';
      case 'bronze':
        return 'bg-orange-600/10 border-orange-600/20';
      default:
        return 'bg-muted/30';
    }
  };

  const calculateWinRate = (wins: number, losses: number) => {
    const total = wins + losses;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  // Calculate category-relative position (1-N per category)
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

  // Determine if player is in relegation or promotion zone
  const getPlayerZone = (player: Player, categoryPlayers: Player[]) => {
    if (!championship || !player.live_rank_category) return null;

    const categoryPosition = getCategoryPosition(player);
    const totalInCategory = categoryPlayers.length;

    // Zone promozione: prime 3 posizioni di Silver e Bronze (controlliamo PRIMA)
    if ((player.live_rank_category === 'silver' || player.live_rank_category === 'bronze') &&
        categoryPosition >= 1 && categoryPosition <= 3) {
      return 'promotion';
    }

    // Zone retrocessione: ultime 3 posizioni di Gold e Silver
    if ((player.live_rank_category === 'gold' || player.live_rank_category === 'silver') &&
        totalInCategory > 3 &&
        categoryPosition >= totalInCategory - 2) {
      return 'relegation';
    }

    return null;
  };

  // Get best live rank with category and check if it's current
  const getBestLiveRank = (player: Player) => {
    if (!player.best_live_rank_category_position || !player.best_category) {
      return {
        position: getCategoryPosition(player),
        category: player.live_rank_category?.charAt(0).toUpperCase() || '',
        isCurrent: true,
      };
    }

    // Map category name to letter
    const categoryLetter = player.best_category === 'gold' ? 'G' :
                          player.best_category === 'silver' ? 'S' : 'B';

    // Check if this is their current position (same category and same position)
    const currentCategoryPosition = getCategoryPosition(player);
    const isCurrent = player.live_rank_category === player.best_category &&
                     currentCategoryPosition === player.best_live_rank_category_position;

    return {
      position: player.best_live_rank_category_position,
      category: categoryLetter,
      isCurrent,
    };
  };

  // Funzione per ottenere il miglior rank nella categoria con storico
  const getBestRankInCategory = (player: Player) => {
    const currentCategory = player.live_rank_category;

    // Se il giocatore e' in gold, mostra solo la miglior posizione in gold
    if (currentCategory === 'gold') {
      return {
        position: player.best_position_in_gold || player.live_rank_position,
        category: 'gold',
        showCategory: false
      };
    }

    // Se il giocatore e' in silver, controlla se e' stato in gold
    if (currentCategory === 'silver') {
      if (player.best_position_in_gold) {
        return {
          position: player.best_position_in_gold,
          category: 'gold',
          showCategory: true
        };
      }
      return {
        position: player.best_position_in_silver || player.live_rank_position,
        category: 'silver',
        showCategory: false
      };
    }

    // Se il giocatore e' in bronze, controlla gold poi silver
    if (currentCategory === 'bronze') {
      if (player.best_position_in_gold) {
        return {
          position: player.best_position_in_gold,
          category: 'gold',
          showCategory: true
        };
      }
      if (player.best_position_in_silver) {
        return {
          position: player.best_position_in_silver,
          category: 'silver',
          showCategory: true
        };
      }
      return {
        position: player.best_position_in_bronze || player.live_rank_position,
        category: 'bronze',
        showCategory: false
      };
    }

    return {
      position: player.live_rank_position,
      category: currentCategory,
      showCategory: false
    };
  };

  // Funzione per determinare la freccia da mostrare basata sul movimento di posizione
  const getPositionArrow = (player: Player) => {
    if (!player.live_rank_position || !player.previous_live_rank_position) {
      return null;
    }

    const currentPos = player.live_rank_position;
    const previousPos = player.previous_live_rank_position;
    const positionDiff = Math.abs(currentPos - previousPos);

    // Detect category swap: large position change (>10) likely indicates a category swap
    // Category swaps happen when moving between Gold (1-20), Silver (21-40), Bronze (41-60)
    const isCategorySwap = positionDiff > 10;

    if (currentPos < previousPos) {
      // Migliorato (numero più basso = posizione migliore)
      return (
        <div className="flex items-center gap-1" title={isCategorySwap ? `Promosso da ${previousPos}° a ${currentPos}°` : `Salito da ${previousPos}° a ${currentPos}°`}>
          <ArrowUp className="h-4 w-4 text-green-600" />
          {!isCategorySwap && <span className="text-xs text-green-600 font-medium">+{previousPos - currentPos}</span>}
        </div>
      );
    } else if (currentPos > previousPos) {
      // Peggiorato (numero più alto = posizione peggiore)
      return (
        <div className="flex items-center gap-1" title={isCategorySwap ? `Retrocesso da ${previousPos}° a ${currentPos}°` : `Sceso da ${previousPos}° a ${currentPos}°`}>
          <ArrowDown className="h-4 w-4 text-red-600" />
          {!isCategorySwap && <span className="text-xs text-red-600 font-medium">-{currentPos - previousPos}</span>}
        </div>
      );
    } else {
      // Nessun cambiamento
      return null;
    }
  };

  const getPlayerAvatar = (userId: string): string | null => {
    const player = allPlayers.find(p => p.user_id === userId);
    return player?.avatar_url || null;
  };

  const getPlayerName = (userId: string): string => {
    const player = allPlayers.find(p => p.user_id === userId);
    return player?.display_name || 'Giocatore';
  };

  const getPlayerInitials = (userId: string): string => {
    const name = getPlayerName(userId);
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0].charAt(0) + parts[1].charAt(0);
    }
    return name.slice(0, 2).toUpperCase();
  };

  // All Scheduled Matches View
  if (showAllScheduled) {
    const weekDays = getNextWeekDays();
    const filteredMatches = selectedDay ? filterMatchesByDay(allScheduledMatches, selectedDay) : allScheduledMatches;
    const groupedMatches = weekView ? groupMatchesByDay(allScheduledMatches) : null;

    return (
      <>
      <div className="p-6 pb-24 space-y-6 bg-gradient-to-br from-tennis-court/5 via-background to-tennis-ball/5 min-h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-tennis-court">Tutte le Partite Programmate</h1>
            <p className="text-muted-foreground">{championship?.name}</p>
          </div>
          <Button variant="outline" onClick={() => setShowAllScheduled(false)}>
            Torna Indietro
          </Button>
        </div>

        {/* Week Days Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={!selectedDay && !weekView ? "default" : "outline"}
            onClick={() => {
              setSelectedDay(null);
              setWeekView(false);
            }}
            className={!selectedDay && !weekView ? "bg-tennis-court hover:bg-tennis-court/90" : ""}
          >
            Tutte
          </Button>
          <Button
            variant={weekView ? "default" : "outline"}
            onClick={() => {
              setWeekView(true);
              setSelectedDay(null);
            }}
            className={weekView ? "bg-tennis-court hover:bg-tennis-court/90" : ""}
          >
            Vedi Settimana
          </Button>
          {weekDays.map((day, index) => {
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const isToday = isSameDay(day, new Date());
            return (
              <Button
                key={index}
                variant={isSelected ? "default" : "outline"}
                onClick={() => {
                  setSelectedDay(day);
                  setWeekView(false);
                }}
                className={`flex flex-col items-center min-w-[70px] h-16 ${
                  isSelected ? "bg-tennis-court hover:bg-tennis-court/90" : ""
                } ${isToday ? "border-tennis-court border-2" : ""}`}
              >
                <span className="text-xs font-semibold">
                  {format(day, 'EEE', { locale: it }).toUpperCase()}
                </span>
                <span className="text-xl font-bold">{format(day, 'd')}</span>
              </Button>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-tennis-court" />
                  {weekView ? 'Partite della Settimana' : selectedDay ? `Partite di ${format(selectedDay, 'PPP', { locale: it })}` : 'Partite in Calendario'}
                  {!weekView && filteredMatches.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {filteredMatches.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {weekView ? 'Partite organizzate per giorno' : selectedDay ? 'Partite programmate per questo giorno' : 'Tutte le sfide programmate nel campionato'}
                </CardDescription>
              </div>
              {allScheduledMatches.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadWeeklyReport}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Scarica Report
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {weekView ? (
              // Week View - Grouped by Day
              <div className="space-y-6">
                {Object.keys(groupedMatches || {}).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Nessuna partita programmata questa settimana</p>
                  </div>
                ) : (
                  Object.entries(groupedMatches || {}).map(([dateKey, dayMatches]) => {
                    const dayDate = new Date(dateKey);
                    return (
                      <div key={dateKey} className="space-y-3">
                        <div className="flex items-center gap-3 pb-2 border-b">
                          <h3 className="text-lg font-bold text-tennis-court">
                            {format(dayDate, 'EEEE d MMMM', { locale: it })}
                          </h3>
                          <Badge variant="outline">{dayMatches.length}</Badge>
                        </div>
                        <div className="space-y-3">
                          {dayMatches.map((match) => {
                            const player1Id = match.winner_id;
                            const player2Id = match.loser_id;
                            const matchDate = new Date(match.played_at);

                            return (
                              <div
                                key={match.id}
                                className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border-l-4 border-tennis-court"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <Avatar 
                                      className="h-12 w-12 shadow-[0_0_15px_rgba(139,195,74,0.4)] cursor-pointer hover:shadow-[0_0_20px_rgba(139,195,74,0.6)] transition-shadow"
                                      onClick={() => handlePlayerClick(player1Id)}
                                    >
                                      {getPlayerAvatar(player1Id) ? (
                                        <img 
                                          src={getPlayerAvatar(player1Id)!} 
                                          alt={getPlayerName(player1Id)}
                                          className="object-cover"
                                        />
                                      ) : (
                                        <AvatarFallback className="bg-tennis-court/10 text-tennis-court">
                                          {getPlayerInitials(player1Id)}
                                        </AvatarFallback>
                                      )}
                                    </Avatar>
                                    <div>
                                      <p 
                                        className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                                        onClick={() => handlePlayerClick(player1Id)}
                                      >
                                        {getPlayerName(player1Id)}
                                      </p>
                                      {player1Id === user?.id && (
                                        <Badge variant="outline" className="text-xs mt-1">Tu</Badge>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 ml-6 my-1">
                                    <div className="h-px bg-border flex-1"></div>
                                    <span className="text-xs text-muted-foreground font-semibold">VS</span>
                                    <div className="h-px bg-border flex-1"></div>
                                  </div>
                                  
                                  <div className="flex items-center gap-3 mt-2">
                                    <Avatar 
                                      className="h-12 w-12 shadow-[0_0_15px_rgba(139,195,74,0.4)] cursor-pointer hover:shadow-[0_0_20px_rgba(139,195,74,0.6)] transition-shadow"
                                      onClick={() => handlePlayerClick(player2Id)}
                                    >
                                      {getPlayerAvatar(player2Id) ? (
                                        <img 
                                          src={getPlayerAvatar(player2Id)!} 
                                          alt={getPlayerName(player2Id)}
                                          className="object-cover"
                                        />
                                      ) : (
                                        <AvatarFallback className="bg-muted">
                                          {getPlayerInitials(player2Id)}
                                        </AvatarFallback>
                                      )}
                                    </Avatar>
                                    <div>
                                      <p 
                                        className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                                        onClick={() => handlePlayerClick(player2Id)}
                                      >
                                        {getPlayerName(player2Id)}
                                      </p>
                                      {player2Id === user?.id && (
                                        <Badge variant="outline" className="text-xs mt-1">Tu</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col items-center justify-center gap-1 px-4 py-2 bg-tennis-court/10 rounded-lg border border-tennis-court/20 min-w-[100px]">
                                  <Clock className="h-4 w-4 text-tennis-court" />
                                  <p className="text-sm font-semibold text-tennis-court">
                                    {format(matchDate, 'HH:mm', { locale: it })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              // Single Day / All Matches View
              <div>
                {filteredMatches.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>{selectedDay ? 'Nessuna partita programmata per questo giorno' : 'Nessuna partita programmata'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                {filteredMatches.map((match) => {
                  const player1Id = match.winner_id;
                  const player2Id = match.loser_id;
                  const matchDate = new Date(match.played_at);

                  return (
                    <div
                      key={match.id}
                      className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border-l-4 border-tennis-court"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Avatar 
                            className="h-12 w-12 shadow-[0_0_15px_rgba(139,195,74,0.4)] cursor-pointer hover:shadow-[0_0_20px_rgba(139,195,74,0.6)] transition-shadow"
                            onClick={() => handlePlayerClick(player1Id)}
                          >
                            {getPlayerAvatar(player1Id) ? (
                              <img 
                                src={getPlayerAvatar(player1Id)!} 
                                alt={getPlayerName(player1Id)}
                                className="object-cover"
                              />
                            ) : (
                              <AvatarFallback className="bg-tennis-court/10 text-tennis-court">
                                {getPlayerInitials(player1Id)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <p 
                              className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                              onClick={() => handlePlayerClick(player1Id)}
                            >
                              {getPlayerName(player1Id)}
                            </p>
                            {player1Id === user?.id && (
                              <Badge variant="outline" className="text-xs mt-1">Tu</Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-6 my-1">
                          <div className="h-px bg-border flex-1"></div>
                          <span className="text-xs text-muted-foreground font-semibold">VS</span>
                          <div className="h-px bg-border flex-1"></div>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-2">
                          <Avatar 
                            className="h-12 w-12 shadow-[0_0_15px_rgba(139,195,74,0.4)] cursor-pointer hover:shadow-[0_0_20px_rgba(139,195,74,0.6)] transition-shadow"
                            onClick={() => handlePlayerClick(player2Id)}
                          >
                            {getPlayerAvatar(player2Id) ? (
                              <img 
                                src={getPlayerAvatar(player2Id)!} 
                                alt={getPlayerName(player2Id)}
                                className="object-cover"
                              />
                            ) : (
                              <AvatarFallback className="bg-muted">
                                {getPlayerInitials(player2Id)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <p 
                              className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                              onClick={() => handlePlayerClick(player2Id)}
                            >
                              {getPlayerName(player2Id)}
                            </p>
                            {player2Id === user?.id && (
                              <Badge variant="outline" className="text-xs mt-1">Tu</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-2 bg-tennis-court/10 rounded-lg border border-tennis-court/20 min-w-[120px]">
                        <Calendar className="h-5 w-5 text-tennis-court" />
                        <div className="text-center">
                          <p className="text-sm font-semibold text-tennis-court">
                            {format(matchDate, 'dd MMM', { locale: it })}
                          </p>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground font-medium">
                              {format(matchDate, 'HH:mm', { locale: it })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
          </CardContent>
        </Card>
      </div>
      
      {/* Player Stats Dialog */}
      <PlayerStatsDialog 
        playerId={selectedPlayerId}
        open={showPlayerDialog}
        onOpenChange={setShowPlayerDialog}
      />
      </>
    );
  }

  // All Results View
  if (showAllResults) {
    const weekDays = getNextWeekDays();
    const filteredMatches = selectedDay ? filterMatchesByDay(allPlayedMatches, selectedDay) : allPlayedMatches;
    const groupedMatches = weekView ? groupMatchesByDay(allPlayedMatches) : null;

    return (
      <>
      <div className="p-6 pb-24 space-y-6 bg-gradient-to-br from-tennis-court/5 via-background to-tennis-ball/5 min-h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-tennis-court">Tutti i Risultati</h1>
            <p className="text-muted-foreground">{championship?.name}</p>
          </div>
          <Button variant="outline" onClick={() => setShowAllResults(false)}>
            Torna Indietro
          </Button>
        </div>

        {/* Week Days Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={!selectedDay && !weekView ? "default" : "outline"}
            onClick={() => {
              setSelectedDay(null);
              setWeekView(false);
            }}
            className={!selectedDay && !weekView ? "bg-tennis-court hover:bg-tennis-court/90" : ""}
          >
            Tutti
          </Button>
          <Button
            variant={weekView ? "default" : "outline"}
            onClick={() => {
              setWeekView(true);
              setSelectedDay(null);
            }}
            className={weekView ? "bg-tennis-court hover:bg-tennis-court/90" : ""}
          >
            Vedi Settimana
          </Button>
          {weekDays.map((day, index) => {
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const isToday = isSameDay(day, new Date());
            return (
              <Button
                key={index}
                variant={isSelected ? "default" : "outline"}
                onClick={() => {
                  setSelectedDay(day);
                  setWeekView(false);
                }}
                className={`flex flex-col items-center min-w-[70px] h-16 ${
                  isSelected ? "bg-tennis-court hover:bg-tennis-court/90" : ""
                } ${isToday ? "border-tennis-court border-2" : ""}`}
              >
                <span className="text-xs font-semibold">
                  {format(day, 'EEE', { locale: it }).toUpperCase()}
                </span>
                <span className="text-xl font-bold">{format(day, 'd')}</span>
              </Button>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-tennis-court" />
              {weekView ? 'Risultati della Settimana' : selectedDay ? `Risultati di ${format(selectedDay, 'PPP', { locale: it })}` : 'Storico Completo'}
              {!weekView && filteredMatches.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {filteredMatches.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {weekView ? 'Risultati organizzati per giorno' : selectedDay ? 'Partite giocate in questo giorno' : 'Tutte le partite giocate nel campionato'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {weekView ? (
              // Week View - Grouped by Day
              <div className="space-y-6">
                {Object.keys(groupedMatches || {}).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Nessun risultato questa settimana</p>
                  </div>
                ) : (
                  Object.entries(groupedMatches || {}).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([dateKey, dayMatches]) => {
                    const dayDate = new Date(dateKey);
                    return (
                      <div key={dateKey} className="space-y-3">
                        <div className="flex items-center gap-3 pb-2 border-b">
                          <h3 className="text-lg font-bold text-tennis-court">
                            {format(dayDate, 'EEEE d MMMM', { locale: it })}
                          </h3>
                          <Badge variant="outline">{dayMatches.length}</Badge>
                        </div>
                        <div className="space-y-3">
                          {dayMatches.map((match) => {
                            const winnerId = match.winner_id;
                            const loserId = match.loser_id;
                            const matchDate = new Date(match.played_at);
                            const sets = match.score.split(' ').filter(s => s.trim() !== '');

                            return (
                              <div key={match.id} className="space-y-2">
                                <div className="flex items-center gap-2 px-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <p className="text-xs text-muted-foreground font-medium">
                                    {format(matchDate, 'HH:mm', { locale: it })}
                                  </p>
                                </div>
                      
                      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border-l-4 border-green-600">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Avatar 
                              className="h-12 w-12 shadow-[0_0_15px_rgba(34,197,94,0.5)] cursor-pointer hover:shadow-[0_0_20px_rgba(34,197,94,0.7)] transition-shadow"
                              onClick={() => handlePlayerClick(winnerId)}
                            >
                              {getPlayerAvatar(winnerId) ? (
                                <img 
                                  src={getPlayerAvatar(winnerId)!} 
                                  alt={getPlayerName(winnerId)}
                                  className="object-cover"
                                />
                              ) : (
                                <AvatarFallback className="bg-green-600/10 text-green-600">
                                  {getPlayerInitials(winnerId)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <p 
                                className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                                onClick={() => handlePlayerClick(winnerId)}
                              >
                                {getPlayerName(winnerId)}
                              </p>
                              <Badge variant="default" className="text-xs mt-1 bg-green-600">Vincitore</Badge>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-6 my-1">
                            <div className="h-px bg-border flex-1"></div>
                            <span className="text-xs text-muted-foreground font-semibold">VS</span>
                            <div className="h-px bg-border flex-1"></div>
                          </div>
                          
                          <div className="flex items-center gap-3 mt-2">
                            <Avatar 
                              className="h-12 w-12 shadow-[0_0_10px_rgba(0,0,0,0.2)] cursor-pointer hover:shadow-[0_0_15px_rgba(139,195,74,0.4)] transition-shadow"
                              onClick={() => handlePlayerClick(loserId)}
                            >
                              {getPlayerAvatar(loserId) ? (
                                <img 
                                  src={getPlayerAvatar(loserId)!} 
                                  alt={getPlayerName(loserId)}
                                  className="object-cover"
                                />
                              ) : (
                                <AvatarFallback className="bg-muted">
                                  {getPlayerInitials(loserId)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <p 
                                className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                                onClick={() => handlePlayerClick(loserId)}
                              >
                                {getPlayerName(loserId)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-1 px-4 py-3 bg-green-600/10 rounded-lg border border-green-600/20 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            {sets.map((set, index) => {
                              const [winnerScore] = set.split('-');
                              return (
                                <span key={index} className="text-xl font-bold text-green-600 w-8 text-center">
                                  {winnerScore}
                                </span>
                              );
                            })}
                            <Trophy className="h-5 w-5 text-green-600 ml-1" />
                          </div>
                          <div className="flex items-center gap-2">
                            {sets.map((set, index) => {
                              const [, loserScore] = set.split('-');
                              return (
                                <span key={index} className="text-xl font-semibold text-muted-foreground w-8 text-center">
                                  {loserScore}
                                </span>
                              );
                            })}
                            <div className="h-5 w-5 ml-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  ) : (
    // Single Day / All Matches View
    <div>
      {filteredMatches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>{selectedDay ? 'Nessuna partita giocata in questo giorno' : 'Nessuna partita ancora disputata'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMatches.map((match) => {
            const winnerId = match.winner_id;
            const loserId = match.loser_id;
            const matchDate = new Date(match.played_at);
            const sets = match.score.split(' ').filter(s => s.trim() !== '');

            return (
              <div key={match.id} className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-medium">
                    {format(matchDate, 'PPP', { locale: it })}
                  </p>
                </div>
                
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border-l-4 border-green-600">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar 
                        className="h-12 w-12 shadow-[0_0_15px_rgba(34,197,94,0.5)] cursor-pointer hover:shadow-[0_0_20px_rgba(34,197,94,0.7)] transition-shadow"
                        onClick={() => handlePlayerClick(winnerId)}
                      >
                        {getPlayerAvatar(winnerId) ? (
                          <img 
                            src={getPlayerAvatar(winnerId)!} 
                            alt={getPlayerName(winnerId)}
                            className="object-cover"
                          />
                        ) : (
                          <AvatarFallback className="bg-green-600/10 text-green-600">
                            {getPlayerInitials(winnerId)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p 
                          className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                          onClick={() => handlePlayerClick(winnerId)}
                        >
                          {getPlayerName(winnerId)}
                        </p>
                        <Badge variant="default" className="text-xs mt-1 bg-green-600">Vincitore</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-6 my-1">
                      <div className="h-px bg-border flex-1"></div>
                      <span className="text-xs text-muted-foreground font-semibold">VS</span>
                      <div className="h-px bg-border flex-1"></div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <Avatar 
                        className="h-12 w-12 shadow-[0_0_10px_rgba(0,0,0,0.2)] cursor-pointer hover:shadow-[0_0_15px_rgba(139,195,74,0.4)] transition-shadow"
                        onClick={() => handlePlayerClick(loserId)}
                      >
                        {getPlayerAvatar(loserId) ? (
                          <img 
                            src={getPlayerAvatar(loserId)!} 
                            alt={getPlayerName(loserId)}
                            className="object-cover"
                          />
                        ) : (
                          <AvatarFallback className="bg-muted">
                            {getPlayerInitials(loserId)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p 
                          className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                          onClick={() => handlePlayerClick(loserId)}
                        >
                          {getPlayerName(loserId)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-1 px-4 py-3 bg-green-600/10 rounded-lg border border-green-600/20 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      {sets.map((set, index) => {
                        const [winnerScore] = set.split('-');
                        return (
                          <span key={index} className="text-xl font-bold text-green-600 w-8 text-center">
                            {winnerScore}
                          </span>
                        );
                      })}
                      <Trophy className="h-5 w-5 text-green-600 ml-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      {sets.map((set, index) => {
                        const [, loserScore] = set.split('-');
                        return (
                          <span key={index} className="text-xl font-semibold text-muted-foreground w-8 text-center">
                            {loserScore}
                          </span>
                        );
                      })}
                      <div className="h-5 w-5 ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )}
          </CardContent>
        </Card>
      </div>
      
      {/* Player Stats Dialog */}
      <PlayerStatsDialog 
        playerId={selectedPlayerId}
        open={showPlayerDialog}
        onOpenChange={setShowPlayerDialog}
      />
      </>
    );
  }

  // Full Live Ranking View
  if (showFullLiveRanking) {
    const goldPlayers = playersWithStats.filter(p => p.live_rank_category === 'gold');
    const silverPlayers = playersWithStats.filter(p => p.live_rank_category === 'silver');
    const bronzePlayers = playersWithStats.filter(p => p.live_rank_category === 'bronze');

    // Componente per renderizzare la tabella di una categoria
    const renderCategoryTable = (players: PlayerWithStats[], categoryName: string, categoryColor: string, borderColor: string, bgColor: string, glowColor: string) => (
      <Card className={`border-${borderColor}/30 ${glowColor}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className={`h-5 w-5 ${categoryColor}`} />
            <span className={categoryColor}>Categoria {categoryName}</span>
          </CardTitle>
          <CardDescription>
            {players.length} giocatori
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Pos.</TableHead>
                  <TableHead>Giocatore</TableHead>
                  <TableHead className="text-center">Stato</TableHead>
                  <TableHead className="text-center">Partite</TableHead>
                  <TableHead className="text-center">Vinte</TableHead>
                  <TableHead className="text-center">Perse</TableHead>
                  <TableHead className="text-center">Pareggi</TableHead>
                  <TableHead className="text-center">Miglior Rank</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player, index) => {
                  const bestRank = getBestRankInCategory(player);
                  const zone = getPlayerZone(player, players);
                  const nextZone = index < players.length - 1 ? getPlayerZone(players[index + 1], players) : null;
                  const prevZone = index > 0 ? getPlayerZone(players[index - 1], players) : null;

                  // Per retrocessione: linea PRIMA della zona (all'inizio)
                  const isRelegationStart = zone === 'relegation' && zone !== prevZone;

                  // Per promozione: linea DOPO la zona (alla fine)
                  const isPromotionEnd = zone === 'promotion' && zone !== nextZone;

                  return (
                    <React.Fragment key={player.id}>
                      {isRelegationStart && (
                        <TableRow className="h-0">
                          <TableCell colSpan={8} className="p-0 border-0">
                            <div className="h-1 bg-red-500"></div>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow
                        className={`
                          ${zone === 'relegation' ? 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30' : ''}
                          ${zone === 'promotion' ? 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30' : ''}
                          ${!zone ? 'hover:bg-muted/50' : ''}
                        `}
                      >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${bgColor} font-bold ${categoryColor}`}>
                            {getCategoryPosition(player)}
                          </div>
                          <div className="w-12 flex items-center justify-start">
                            {getPositionArrow(player)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => handlePlayerClick(player.user_id)}
                          >
                            {player.avatar_url ? (
                              <img
                                src={player.avatar_url}
                                alt={player.display_name}
                                className="object-cover"
                              />
                            ) : (
                              <AvatarFallback className={`${bgColor} ${categoryColor}`}>
                                {player.display_name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex items-center gap-2">
                            <div
                              className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                              onClick={() => handlePlayerClick(player.user_id)}
                            >
                              {player.display_name}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {player.user_id === user?.id ? (
                            <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                              <span className="text-xs text-muted-foreground font-medium">Tu</span>
                            </div>
                          ) : player.availability_status === 'suspended' ? (
                            <button
                              onClick={() => handleSuspensionClick(player)}
                              className="group h-6 w-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 shadow-lg hover:shadow-xl hover:shadow-orange-500/50 transition-all duration-300 hover:scale-110 flex items-center justify-center cursor-pointer"
                              title="Sospeso - Clicca per dettagli"
                            >
                              <div className="h-2.5 w-0.5 bg-white rounded-full" />
                            </button>
                          ) : player.isChallengeable ? (
                            <button
                              onClick={() => handleChallengeClick(player)}
                              className="group relative h-6 w-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 shadow-lg hover:shadow-xl hover:shadow-green-500/50 transition-all duration-300 hover:scale-110 flex items-center justify-center"
                              title="Disponibile - Clicca per sfidare"
                            >
                              <Swords className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                              <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
                            </button>
                          ) : (
                            <div
                              className="h-6 w-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-md flex items-center justify-center cursor-not-allowed opacity-60"
                              title="Non disponibile per sfide"
                            >
                              <div className="h-2.5 w-0.5 bg-white rounded-full" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-blue-600">{player.yearlyMatches}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-green-600">{player.yearlyWins}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-red-600">{player.yearlyLosses}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-orange-600">{player.yearlyDraws}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {(() => {
                            const bestRank = getBestLiveRank(player);
                            if (bestRank.isCurrent) {
                              return (
                                <Badge className="bg-orange-500 text-white px-2 py-1">MR</Badge>
                              );
                            } else {
                              const categoryColor =
                                bestRank.category === 'G' ? 'bg-yellow-600 text-white' :
                                bestRank.category === 'S' ? 'bg-gray-400 text-white' :
                                'bg-amber-700 text-white';

                              return (
                                <>
                                  <span className="font-bold text-tennis-court">
                                    {bestRank.position}°
                                  </span>
                                  <Badge className={`text-xs px-1.5 py-0.5 ${categoryColor}`}>
                                    {bestRank.category}
                                  </Badge>
                                </>
                              );
                            }
                          })()}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isPromotionEnd && (
                      <TableRow className="h-0">
                        <TableCell colSpan={8} className="p-0 border-0">
                          <div className="h-1 bg-green-500"></div>
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );

    return (
      <>
      <div className="p-6 pb-24 space-y-6 bg-gradient-to-br from-tennis-court/5 via-background to-tennis-ball/5 min-h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-tennis-court">Classifica Live Completa</h1>
            <p className="text-muted-foreground">{championship?.name}</p>
          </div>
          <Button variant="outline" onClick={() => setShowFullLiveRanking(false)}>
            Torna Indietro
          </Button>
        </div>

        {/* Legenda Zone */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center justify-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-4 bg-green-100 dark:bg-green-950/40 border-l-4 border-l-green-500 rounded"></div>
                <span className="font-medium">Zona Promozione</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-4 bg-red-100 dark:bg-red-950/40 border-l-4 border-l-red-500 rounded"></div>
                <span className="font-medium">Zona Retrocessione</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gold Category */}
        {goldPlayers.length > 0 && renderCategoryTable(goldPlayers, 'Gold', 'text-yellow-600', 'yellow-600', 'bg-yellow-600/20', 'shadow-[0_0_25px_rgba(202,138,4,0.5)] dark:shadow-[0_0_30px_rgba(250,204,21,0.4)]')}

        {/* Silver Category */}
        {silverPlayers.length > 0 && renderCategoryTable(silverPlayers, 'Silver', 'text-gray-400', 'gray-400', 'bg-gray-400/20', 'shadow-[0_0_25px_rgba(107,114,128,0.5)] dark:shadow-[0_0_30px_rgba(156,163,175,0.4)]')}

        {/* Bronze Category */}
        {bronzePlayers.length > 0 && renderCategoryTable(bronzePlayers, 'Bronze', 'text-orange-600', 'orange-600', 'bg-orange-600/20', 'shadow-[0_0_25px_rgba(234,88,12,0.5)] dark:shadow-[0_0_30px_rgba(249,115,22,0.4)]')}
      </div>

      {/* Player Stats Dialog */}
      <PlayerStatsDialog
        playerId={selectedPlayerId}
        open={showPlayerDialog}
        onOpenChange={setShowPlayerDialog}
      />

      {/* Challenge Confirmation Modal */}
      <Dialog open={showChallengeModal} onOpenChange={setShowChallengeModal}>
        <DialogContent className="sm:max-w-md overflow-hidden p-0">
          {/* Header with gradient background */}
          <div className="relative bg-gradient-to-br from-tennis-court via-green-600 to-emerald-600 px-6 py-8 text-white">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />

            <div className="relative">
              <div className="flex items-center justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl">
                  <Swords className="h-8 w-8 text-white" />
                </div>
              </div>
              <DialogTitle className="text-center text-2xl font-bold mb-2">
                Lancia una Sfida
              </DialogTitle>
              <DialogDescription className="text-center text-white/90 text-base">
                Stai per sfidare un avversario a tennis
              </DialogDescription>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            {/* Player card */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                Avversario
              </p>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-tennis-court/20">
                  {challengedPlayer?.avatar_url ? (
                    <img
                      src={challengedPlayer.avatar_url}
                      alt={challengedPlayer.display_name}
                      className="object-cover"
                    />
                  ) : (
                    <AvatarFallback className="bg-tennis-court/10 text-tennis-court font-bold">
                      {challengedPlayer?.display_name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <p className="font-bold text-lg text-tennis-court">
                    {challengedPlayer?.display_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Posizione: {challengedPlayer?.live_rank_position ? `${challengedPlayer.live_rank_position}°` : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Info box */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <div className="h-6 w-6 rounded-full bg-tennis-court/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-tennis-court font-bold text-xs">1</span>
                </div>
                <p className="text-muted-foreground">
                  L'avversario riceverà una <span className="font-semibold text-foreground">notifica via email</span>
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="h-6 w-6 rounded-full bg-tennis-court/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-tennis-court font-bold text-xs">2</span>
                </div>
                <p className="text-muted-foreground">
                  Dovrà <span className="font-semibold text-foreground">accettare la sfida</span> per procedere
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="h-6 w-6 rounded-full bg-tennis-court/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-tennis-court font-bold text-xs">3</span>
                </div>
                <p className="text-muted-foreground">
                  Potrete concordare <span className="font-semibold text-foreground">data e ora</span> della partita
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 pb-6 gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowChallengeModal(false);
                setChallengedPlayer(null);
              }}
              disabled={isLaunchingChallenge}
              className="flex-1"
            >
              Annulla
            </Button>
            <Button
              onClick={handleLaunchChallenge}
              disabled={isLaunchingChallenge}
              className="flex-1 bg-gradient-to-r from-tennis-court to-green-600 hover:from-green-600 hover:to-tennis-court shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isLaunchingChallenge ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Invio...
                </>
              ) : (
                <>
                  <Swords className="h-4 w-4 mr-2" />
                  Lancia Sfida
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspension Reason Dialog */}
      <SuspensionReasonDialog
        open={showSuspensionDialog && !!selectedSuspendedPlayer?.suspension}
        onOpenChange={setShowSuspensionDialog}
        playerName={selectedSuspendedPlayer?.display_name || ''}
        startDate={selectedSuspendedPlayer?.suspension?.start_date || ''}
        endDate={selectedSuspendedPlayer?.suspension?.end_date || ''}
        reason={selectedSuspendedPlayer?.suspension?.reason || ''}
      />
      </>
    );
  }

  // Full Pro Master Ranking View
  if (showFullProMasterRanking) {
    return (
      <>
      <div className="p-6 pb-24 space-y-6 bg-gradient-to-br from-tennis-court/5 via-background to-tennis-ball/5 min-h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-tennis-court">Classifica Pro Master Completa</h1>
            <p className="text-muted-foreground">{championship?.name}</p>
          </div>
          <Button variant="outline" onClick={() => setShowFullProMasterRanking(false)}>
            Torna Indietro
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Pos.</TableHead>
                    <TableHead>Giocatore</TableHead>
                    <TableHead className="text-center">Punti Pro Master</TableHead>
                    <TableHead className="text-center">Posizione Live</TableHead>
                    <TableHead className="text-center">Miglior Rank Pro Master</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...allPlayers]
                    .sort((a, b) => (a.pro_master_rank_position || 999) - (b.pro_master_rank_position || 999))
                    .map((player) => (
                    <TableRow key={player.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center justify-center font-semibold">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-tennis-court/10 font-bold text-tennis-court">
                            {player.pro_master_rank_position || '-'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar 
                            className="h-10 w-10 shadow-[0_0_10px_rgba(139,195,74,0.3)] cursor-pointer hover:shadow-[0_0_15px_rgba(139,195,74,0.5)] transition-shadow"
                            onClick={() => handlePlayerClick(player.user_id)}
                          >
                            {player.avatar_url ? (
                              <img 
                                src={player.avatar_url} 
                                alt={player.display_name}
                                className="object-cover"
                              />
                            ) : (
                              <AvatarFallback className="bg-tennis-court/10 text-tennis-court text-sm">
                                {player.display_name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div
                            className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                            onClick={() => handlePlayerClick(player.user_id)}
                          >
                            {player.display_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-tennis-court text-xl">
                          {player.pro_master_points.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {(() => {
                            const categoryLetter = player.live_rank_category?.charAt(0).toUpperCase() || '';
                            const categoryBadgeColor =
                              player.live_rank_category === 'gold' ? 'bg-yellow-600 text-white' :
                              player.live_rank_category === 'silver' ? 'bg-gray-400 text-white' :
                              'bg-amber-700 text-white';

                            return (
                              <>
                                <span className="font-medium">
                                  {getCategoryPosition(player)}°
                                </span>
                                <Badge className={`text-xs px-1.5 py-0.5 ${categoryBadgeColor}`}>
                                  {categoryLetter}
                                </Badge>
                              </>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {(() => {
                            const isBestProMaster = player.pro_master_rank_position === player.best_pro_master_rank;
                            if (isBestProMaster) {
                              return (
                                <Badge className="bg-orange-500 text-white px-2 py-1">MR</Badge>
                              );
                            } else {
                              return (
                                <span className="font-medium">
                                  {player.best_pro_master_rank ? `${player.best_pro_master_rank}°` : '-'}
                                </span>
                              );
                            }
                          })()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Player Stats Dialog */}
      <PlayerStatsDialog 
        playerId={selectedPlayerId}
        open={showPlayerDialog}
        onOpenChange={setShowPlayerDialog}
      />
      </>
    );
  }

  // Main View
  if (loading) {
    return (
      <div className="p-6 pb-24 space-y-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="p-6 pb-24 space-y-6 bg-gradient-to-br from-tennis-court/5 via-background to-tennis-ball/5 min-h-full">
      <div>
        <h1 className="text-3xl font-bold text-tennis-court">Campionato</h1>
        <p className="text-muted-foreground">Visualizzazione di classifiche e partite</p>
      </div>

      {/* Live Ranking */}
      <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={loadFullLiveRanking}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-tennis-court" />
            Classifica Live
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {topLivePlayers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun giocatore in classifica</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Gold Category - Top 3 */}
                {topLivePlayers.filter(p => p.live_rank_category === 'gold').length > 0 && (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <div className="bg-yellow-600 px-6 py-2 rounded-lg shadow-[0_0_30px_rgba(202,138,4,0.9),0_0_50px_rgba(202,138,4,0.6)]">
                        <h3 className="text-lg font-bold text-white text-center uppercase tracking-wider">
                          Gold
                        </h3>
                      </div>
                    </div>
                    <div className="border-2 border-yellow-600 rounded-lg p-4 bg-yellow-600/5 shadow-[0_0_20px_rgba(202,138,4,0.5)]">
                      <div className="space-y-2">
                      {topLivePlayers
                        .filter(p => p.live_rank_category === 'gold')
                        .map((player) => {
                          const winRate = calculateWinRate(player.wins, player.losses);

                          return (
                            <div
                              key={player.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-yellow-600/10 hover:bg-yellow-600/20 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-600/30 font-bold text-yellow-900 dark:text-yellow-100">
                                  {getCategoryPosition(player)}
                                </div>
                                <Avatar
                                  className="h-10 w-10 cursor-pointer transition-shadow shadow-[0_0_12px_rgba(202,138,4,0.4)] hover:shadow-[0_0_17px_rgba(202,138,4,0.6)]"
                                  onClick={(e) => { e.stopPropagation(); handlePlayerClick(player.user_id); }}
                                >
                                  {player.avatar_url ? (
                                    <img
                                      src={player.avatar_url}
                                      alt={player.display_name}
                                      className="object-cover"
                                    />
                                  ) : (
                                    <AvatarFallback className="bg-yellow-600/10 text-yellow-600 text-xs">
                                      {player.display_name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <div>
                                  <div
                                    className="font-medium cursor-pointer hover:text-tennis-court transition-colors text-sm"
                                    onClick={(e) => { e.stopPropagation(); handlePlayerClick(player.user_id); }}
                                  >
                                    {player.display_name}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Silver Category - Top 3 */}
                {topLivePlayers.filter(p => p.live_rank_category === 'silver').length > 0 && (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <div className="bg-gray-500 px-6 py-2 rounded-lg shadow-[0_0_30px_rgba(107,114,128,0.9),0_0_50px_rgba(107,114,128,0.6)]">
                        <h3 className="text-lg font-bold text-white text-center uppercase tracking-wider">
                          Silver
                        </h3>
                      </div>
                    </div>
                    <div className="border-2 border-gray-400 rounded-lg p-4 bg-gray-400/5 shadow-[0_0_20px_rgba(156,163,175,0.5)]">
                      <div className="space-y-2">
                      {topLivePlayers
                        .filter(p => p.live_rank_category === 'silver')
                        .map((player) => {
                          const winRate = calculateWinRate(player.wins, player.losses);

                          return (
                            <div
                              key={player.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-gray-400/10 hover:bg-gray-400/20 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-400/30 font-bold text-gray-900 dark:text-gray-100">
                                  {getCategoryPosition(player)}
                                </div>
                                <Avatar
                                  className="h-10 w-10 cursor-pointer transition-shadow shadow-[0_0_12px_rgba(156,163,175,0.4)] hover:shadow-[0_0_17px_rgba(156,163,175,0.6)]"
                                  onClick={(e) => { e.stopPropagation(); handlePlayerClick(player.user_id); }}
                                >
                                  {player.avatar_url ? (
                                    <img
                                      src={player.avatar_url}
                                      alt={player.display_name}
                                      className="object-cover"
                                    />
                                  ) : (
                                    <AvatarFallback className="bg-gray-400/10 text-gray-400 text-xs">
                                      {player.display_name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <div>
                                  <div
                                    className="font-medium cursor-pointer hover:text-tennis-court transition-colors text-sm"
                                    onClick={(e) => { e.stopPropagation(); handlePlayerClick(player.user_id); }}
                                  >
                                    {player.display_name}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bronze Category - Top 3 */}
                {topLivePlayers.filter(p => p.live_rank_category === 'bronze').length > 0 && (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <div className="bg-orange-600 px-6 py-2 rounded-lg shadow-[0_0_30px_rgba(234,88,12,0.9),0_0_50px_rgba(234,88,12,0.6)]">
                        <h3 className="text-lg font-bold text-white text-center uppercase tracking-wider">
                          Bronze
                        </h3>
                      </div>
                    </div>
                    <div className="border-2 border-orange-600 rounded-lg p-4 bg-orange-600/5 shadow-[0_0_20px_rgba(234,88,12,0.5)]">
                      <div className="space-y-2">
                      {topLivePlayers
                        .filter(p => p.live_rank_category === 'bronze')
                        .map((player) => {
                          const winRate = calculateWinRate(player.wins, player.losses);

                          return (
                            <div
                              key={player.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-orange-600/10 hover:bg-orange-600/20 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-600/30 font-bold text-orange-900 dark:text-orange-100">
                                  {getCategoryPosition(player)}
                                </div>
                                <Avatar
                                  className="h-10 w-10 cursor-pointer transition-shadow shadow-[0_0_12px_rgba(234,88,12,0.4)] hover:shadow-[0_0_17px_rgba(234,88,12,0.6)]"
                                  onClick={(e) => { e.stopPropagation(); handlePlayerClick(player.user_id); }}
                                >
                                  {player.avatar_url ? (
                                    <img
                                      src={player.avatar_url}
                                      alt={player.display_name}
                                      className="object-cover"
                                    />
                                  ) : (
                                    <AvatarFallback className="bg-orange-600/10 text-orange-600 text-xs">
                                      {player.display_name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <div>
                                  <div
                                    className="font-medium cursor-pointer hover:text-tennis-court transition-colors text-sm"
                                    onClick={(e) => { e.stopPropagation(); handlePlayerClick(player.user_id); }}
                                  >
                                    {player.display_name}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={(e) => { e.stopPropagation(); loadFullLiveRanking(); }}
                variant="outline"
                className="w-full border-tennis-court text-tennis-court hover:bg-tennis-court hover:text-white"
              >
                Vedi Classifica Completa
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pro Master Ranking */}
      <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={loadFullProMasterRanking}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-tennis-court" />
            Classifica Pro Master
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {topProMasterPlayers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun punteggio ancora assegnato</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {topProMasterPlayers.map((player) => {
                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-tennis-court/10 font-bold text-tennis-court">
                          {player.pro_master_rank_position || '-'}
                        </div>
                        <Avatar
                          className="h-12 w-12 shadow-[0_0_12px_rgba(139,195,74,0.3)] cursor-pointer hover:shadow-[0_0_17px_rgba(139,195,74,0.5)] transition-shadow"
                          onClick={(e) => { e.stopPropagation(); handlePlayerClick(player.user_id); }}
                        >
                          {player.avatar_url ? (
                            <img 
                              src={player.avatar_url} 
                              alt={player.display_name}
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="bg-tennis-court/10 text-tennis-court">
                              {player.display_name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <div
                            className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                            onClick={(e) => { e.stopPropagation(); handlePlayerClick(player.user_id); }}
                          >
                            {player.display_name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-tennis-court text-xl">
                          {player.pro_master_points.toFixed(1)}
                        </span>
                        <p className="text-xs text-muted-foreground">punti</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={(e) => { e.stopPropagation(); loadFullProMasterRanking(); }}
                variant="outline"
                className="w-full border-tennis-court text-tennis-court hover:bg-tennis-court hover:text-white"
              >
                Vedi Classifica Completa
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Matches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-tennis-court" />
            Prossime Partite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {upcomingMatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna partita programmata</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {upcomingMatches.map((match) => {
                  const player1Id = match.winner_id;
                  const player2Id = match.loser_id;
                  const matchDate = new Date(match.played_at);

                  return (
                    <div
                      key={match.id}
                      className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border-l-4 border-tennis-court"
                    >
                      {/* Players Column */}
                      <div className="flex-1">
                        {/* Player 1 */}
                        <div className="flex items-center gap-3 mb-2">
                          <Avatar 
                            className="h-12 w-12 shadow-[0_0_15px_rgba(139,195,74,0.4)] cursor-pointer hover:shadow-[0_0_20px_rgba(139,195,74,0.6)] transition-shadow"
                            onClick={() => handlePlayerClick(player1Id)}
                          >
                            {getPlayerAvatar(player1Id) ? (
                              <img 
                                src={getPlayerAvatar(player1Id)!} 
                                alt={getPlayerName(player1Id)}
                                className="object-cover"
                              />
                            ) : (
                              <AvatarFallback className="bg-tennis-court/10 text-tennis-court">
                                {getPlayerInitials(player1Id)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <p 
                              className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                              onClick={() => handlePlayerClick(player1Id)}
                            >
                              {getPlayerName(player1Id)}
                            </p>
                            {player1Id === user?.id && (
                              <Badge variant="outline" className="text-xs mt-1">Tu</Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* VS Divider */}
                        <div className="flex items-center gap-2 ml-6 my-1">
                          <div className="h-px bg-border flex-1"></div>
                          <span className="text-xs text-muted-foreground font-semibold">VS</span>
                          <div className="h-px bg-border flex-1"></div>
                        </div>
                        
                        {/* Player 2 */}
                        <div className="flex items-center gap-3 mt-2">
                          <Avatar 
                            className="h-12 w-12 shadow-[0_0_15px_rgba(139,195,74,0.4)] cursor-pointer hover:shadow-[0_0_20px_rgba(139,195,74,0.6)] transition-shadow"
                            onClick={() => handlePlayerClick(player2Id)}
                          >
                            {getPlayerAvatar(player2Id) ? (
                              <img 
                                src={getPlayerAvatar(player2Id)!} 
                                alt={getPlayerName(player2Id)}
                                className="object-cover"
                              />
                            ) : (
                              <AvatarFallback className="bg-muted">
                                {getPlayerInitials(player2Id)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <p 
                              className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                              onClick={() => handlePlayerClick(player2Id)}
                            >
                              {getPlayerName(player2Id)}
                            </p>
                            {player2Id === user?.id && (
                              <Badge variant="outline" className="text-xs mt-1">Tu</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Time Column */}
                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-2 bg-tennis-court/10 rounded-lg border border-tennis-court/20 min-w-[120px]">
                        <Calendar className="h-5 w-5 text-tennis-court" />
                        <div className="text-center">
                          <p className="text-sm font-semibold text-tennis-court">
                            {format(matchDate, 'dd MMM', { locale: it })}
                          </p>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground font-medium">
                              {format(matchDate, 'HH:mm', { locale: it })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                variant="outline"
                className="w-full border-tennis-court text-tennis-court hover:bg-tennis-court hover:text-white"
                onClick={loadAllScheduled}
              >
                Vedi Tutte le Partite
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Matches History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-tennis-court" />
            Storico Partite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentMatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna partita ancora disputata</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {recentMatches.map((match) => {
                  const winnerId = match.winner_id;
                  const loserId = match.loser_id;
                  const matchDate = new Date(match.played_at);
                  
                  // Parse score (es: "6-4 6-3" o "6-4 3-6 7-5")
                  const sets = match.score.split(' ').filter(s => s.trim() !== '');

                  return (
                    <div key={match.id} className="space-y-2">
                      {/* Date Header */}
                      <div className="flex items-center gap-2 px-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground font-medium">
                          {format(matchDate, 'PPP', { locale: it })}
                        </p>
                      </div>
                      
                      {/* Match Card */}
                      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border-l-4 border-green-600">
                        {/* Players Column */}
                        <div className="flex-1">
                          {/* Winner */}
                          <div className="flex items-center gap-3 mb-2">
                            <Avatar 
                              className="h-12 w-12 shadow-[0_0_15px_rgba(34,197,94,0.5)] cursor-pointer hover:shadow-[0_0_20px_rgba(34,197,94,0.7)] transition-shadow"
                              onClick={() => handlePlayerClick(winnerId)}
                            >
                              {getPlayerAvatar(winnerId) ? (
                                <img 
                                  src={getPlayerAvatar(winnerId)!} 
                                  alt={getPlayerName(winnerId)}
                                  className="object-cover"
                                />
                              ) : (
                                <AvatarFallback className="bg-green-600/10 text-green-600">
                                  {getPlayerInitials(winnerId)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <p 
                                className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                                onClick={() => handlePlayerClick(winnerId)}
                              >
                                {getPlayerName(winnerId)}
                              </p>
                              <Badge variant="default" className="text-xs mt-1 bg-green-600">Vincitore</Badge>
                            </div>
                          </div>
                          
                          {/* VS Divider */}
                          <div className="flex items-center gap-2 ml-6 my-1">
                            <div className="h-px bg-border flex-1"></div>
                            <span className="text-xs text-muted-foreground font-semibold">VS</span>
                            <div className="h-px bg-border flex-1"></div>
                          </div>
                          
                          {/* Loser */}
                          <div className="flex items-center gap-3 mt-2">
                            <Avatar 
                              className="h-12 w-12 shadow-[0_0_10px_rgba(0,0,0,0.2)] cursor-pointer hover:shadow-[0_0_15px_rgba(139,195,74,0.4)] transition-shadow"
                              onClick={() => handlePlayerClick(loserId)}
                            >
                              {getPlayerAvatar(loserId) ? (
                                <img 
                                  src={getPlayerAvatar(loserId)!} 
                                  alt={getPlayerName(loserId)}
                                  className="object-cover"
                                />
                              ) : (
                                <AvatarFallback className="bg-muted">
                                  {getPlayerInitials(loserId)}
                                </AvatarFallback>
                                )}
                            </Avatar>
                            <div>
                              <p 
                                className="font-medium cursor-pointer hover:text-tennis-court transition-colors"
                                onClick={() => handlePlayerClick(loserId)}
                              >
                                {getPlayerName(loserId)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Score Column - Horizontal Sets */}
                        <div className="flex flex-col items-center justify-center gap-1 px-4 py-3 bg-green-600/10 rounded-lg border border-green-600/20 min-w-[120px]">
                          {/* Winner scores */}
                          <div className="flex items-center gap-2">
                            {sets.map((set, index) => {
                              const [winnerScore] = set.split('-');
                              return (
                                <span key={index} className="text-xl font-bold text-green-600 w-8 text-center">
                                  {winnerScore}
                                </span>
                              );
                            })}
                            <Trophy className="h-5 w-5 text-green-600 ml-1" />
                          </div>
                          {/* Loser scores */}
                          <div className="flex items-center gap-2">
                            {sets.map((set, index) => {
                              const [, loserScore] = set.split('-');
                              return (
                                <span key={index} className="text-xl font-semibold text-muted-foreground w-8 text-center">
                                  {loserScore}
                                </span>
                              );
                            })}
                            {/* Spacer to align with trophy */}
                            <div className="h-5 w-5 ml-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                variant="outline"
                className="w-full border-tennis-court text-tennis-court hover:bg-tennis-court hover:text-white"
                onClick={loadAllResults}
              >
                Vedi tutti i Risultati
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
    
    {/* Player Stats Dialog */}
    <PlayerStatsDialog
      playerId={selectedPlayerId}
      open={showPlayerDialog}
      onOpenChange={setShowPlayerDialog}
    />
    </>
  );
};

export default Championships;
