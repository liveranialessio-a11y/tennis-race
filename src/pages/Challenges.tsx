import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameWeek, isSameMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Swords, Plus, Calendar as CalendarIcon, Clock,
  ChevronLeft, ChevronRight, Check, CheckCircle, XCircle,
  FileCheck, History, Trophy, Trash2, Send, Edit
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { sendChallengeEmail, formatDateForEmail, formatTimeForEmail } from '@/services/emailService';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Player {
  id: string;
  user_id: string;
  display_name: string;
  current_rank: number;
  avatar_url: string | null;
  live_rank_category: string;
  phone?: string | null;
}

interface Match {
  id: string;
  championship_id: string;
  winner_id: string;
  loser_id: string;
  score: string;
  played_at: string;
  is_scheduled: boolean;
  challenge_status: 'lanciata' | 'accettata' | null;
  challenge_launcher_id: string | null;
}

const Challenges: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [championshipId, setChampionshipId] = useState<string>('');
  const [currentUserCategory, setCurrentUserCategory] = useState<string>('');
  
  // Dialog states
  const [newChallengeOpen, setNewChallengeOpen] = useState(false);
  const [launchChallengeOpen, setLaunchChallengeOpen] = useState(false);
  const [setDateTimeOpen, setSetDateTimeOpen] = useState(false);
  const [selectedChallengeForDateTime, setSelectedChallengeForDateTime] = useState<Match | null>(null);
  const [registerResultOpen, setRegisterResultOpen] = useState(false);
  const [fullHistoryOpen, setFullHistoryOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [dateTimeStep, setDateTimeStep] = useState(1); // Step for Set Date/Time Dialog
  const [historyFilter, setHistoryFilter] = useState<'all' | 'week' | 'month'>('all');
  const [blockReasonOpen, setBlockReasonOpen] = useState(false);
  const [blockReason, setBlockReason] = useState<'scheduled' | 'toRegister' | 'launchedChallenge' | null>(null);

  // New filter states for full history
  const [historyFilterType, setHistoryFilterType] = useState<'month' | 'year' | 'all'>('all');
  const [historySelectedYear, setHistorySelectedYear] = useState<number>(new Date().getFullYear());
  const [historySelectedMonth, setHistorySelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [historyResultFilter, setHistoryResultFilter] = useState<'all' | 'win' | 'loss' | 'draw'>('all');
  
  // Form data - New Challenge
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Form data - Register Result
  const [resultOpponent, setResultOpponent] = useState<Player | null>(null);
  // Punteggi per giocatore (player1 = utente corrente, player2 = avversario)
  const [player1Set1, setPlayer1Set1] = useState<number | null>(null);
  const [player2Set1, setPlayer2Set1] = useState<number | null>(null);
  const [player1Set2, setPlayer1Set2] = useState<number | null>(null);
  const [player2Set2, setPlayer2Set2] = useState<number | null>(null);
  // Dialog di conferma
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    winnerId: string;
    loserId: string;
    score: string;
    isDraw: boolean;
    player1Total: number;
    player2Total: number;
    player1Name: string;
    player2Name: string;
  } | null>(null);

  // Constants for filters
  const availableYears = Array.from(
    { length: new Date().getFullYear() - 2019 + 2 },
    (_, i) => 2020 + i
  );

  const months = [
    { value: 1, label: 'Gennaio' },
    { value: 2, label: 'Febbraio' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Aprile' },
    { value: 5, label: 'Maggio' },
    { value: 6, label: 'Giugno' },
    { value: 7, label: 'Luglio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Settembre' },
    { value: 10, label: 'Ottobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Dicembre' },
  ];

  // Computed values - filtra sfide future e passate
  const launchedChallenges = useMemo(() => {
    return allMatches
      .filter(match => match.challenge_status === 'lanciata' || match.challenge_status === 'accettata')
      .sort((a, b) => new Date(b.created_at || b.played_at).getTime() - new Date(a.created_at || a.played_at).getTime());
  }, [allMatches]);

  const scheduledMatches = useMemo(() => {
    const now = new Date();
    return allMatches
      .filter(match =>
        match.is_scheduled &&
        !match.challenge_status &&
        new Date(match.played_at) > now
      )
      .sort((a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime());
  }, [allMatches]);

  // Match programmati passati che devono essere registrati
  const matchesToRegister = useMemo(() => {
    const now = new Date();
    return allMatches
      .filter(match =>
        match.is_scheduled &&
        !match.challenge_status &&
        new Date(match.played_at) <= now
      )
      .sort((a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime());
  }, [allMatches]);

  const matchHistory = useMemo(() => {
    const playedMatches = allMatches.filter(match => !match.is_scheduled && !match.challenge_status);
    return playedMatches
      .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
      .slice(0, 3);
  }, [allMatches]);

  const fullMatchHistory = useMemo(() => {
    const playedMatches = allMatches.filter(match => !match.is_scheduled && !match.challenge_status);
    return playedMatches
      .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
  }, [allMatches]);

  const filteredMatchHistory = useMemo(() => {
    const now = new Date();

    if (historyFilter === 'week') {
      return fullMatchHistory.filter(match =>
        isSameWeek(new Date(match.played_at), now, { locale: it })
      );
    } else if (historyFilter === 'month') {
      return fullMatchHistory.filter(match =>
        isSameMonth(new Date(match.played_at), now)
      );
    }

    return fullMatchHistory;
  }, [fullMatchHistory, historyFilter]);

  const groupedMatchHistory = useMemo(() => {
    if (historyFilter === 'all') {
      return [{ label: 'Tutte le partite', matches: filteredMatchHistory }];
    }

    const groups = new Map<string, Match[]>();

    filteredMatchHistory.forEach(match => {
      const matchDate = new Date(match.played_at);
      let key: string;

      if (historyFilter === 'week') {
        // Raggruppa per giorno della settimana
        key = format(matchDate, 'EEEE dd MMM yyyy', { locale: it });
      } else {
        // Raggruppa per settimana del mese
        const weekStart = startOfWeek(matchDate, { locale: it });
        const weekEnd = endOfWeek(matchDate, { locale: it });
        key = `${format(weekStart, 'dd MMM', { locale: it })} - ${format(weekEnd, 'dd MMM', { locale: it })}`;
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(match);
    });

    return Array.from(groups.entries()).map(([label, matches]) => ({
      label,
      matches
    }));
  }, [filteredMatchHistory, historyFilter]);

  // New filtered history with enhanced filters
  const enhancedFilteredHistory = useMemo(() => {
    let filtered = [...fullMatchHistory];

    // Apply time filter
    if (historyFilterType === 'month') {
      filtered = filtered.filter(match => {
        const matchDate = new Date(match.played_at);
        return matchDate.getFullYear() === historySelectedYear &&
               matchDate.getMonth() + 1 === historySelectedMonth;
      });
    } else if (historyFilterType === 'year') {
      filtered = filtered.filter(match => {
        const matchDate = new Date(match.played_at);
        return matchDate.getFullYear() === historySelectedYear;
      });
    }

    // Apply result filter
    if (historyResultFilter !== 'all') {
      filtered = filtered.filter(match => {
        if (historyResultFilter === 'draw') {
          return match.is_draw;
        } else if (historyResultFilter === 'win') {
          return !match.is_draw && match.winner_id === user?.id;
        } else if (historyResultFilter === 'loss') {
          return !match.is_draw && match.loser_id === user?.id;
        }
        return true;
      });
    }

    return filtered;
  }, [fullMatchHistory, historyFilterType, historySelectedYear, historySelectedMonth, historyResultFilter, user]);

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPlayers(
        players.filter(p =>
          p.user_id !== user?.id &&
          p.live_rank_category === currentUserCategory
        )
      );
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredPlayers(
        players.filter(
          (player) =>
            player.user_id !== user?.id &&
            player.live_rank_category === currentUserCategory &&
            player.display_name.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, players, user, currentUserCategory]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: champData } = await supabase
        .from('championships')
        .select('id')
        .limit(1)
        .single();

      if (!champData) return;
      setChampionshipId(champData.id);

      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('championship_id', champData.id);

      setPlayers(playersData || []);

      if (!user?.id) return;

      // Get current user's category
      const currentPlayer = playersData?.find(p => p.user_id === user.id);
      if (currentPlayer) {
        setCurrentUserCategory(currentPlayer.live_rank_category);
      }

      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .eq('championship_id', champData.id)
        .or(`winner_id.eq.${user.id},loser_id.eq.${user.id}`)
        .order('played_at', { ascending: false });

      setAllMatches(matchesData || []);
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

  const getPlayerName = (userId: string) => {
    const player = players.find(p => p.user_id === userId);
    return player?.display_name || 'Giocatore';
  };

  const getPlayerAvatar = (userId: string): string | null => {
    const player = players.find(p => p.user_id === userId);
    return player?.avatar_url || null;
  };

  const getPlayerInitials = (userId: string) => {
    const name = getPlayerName(userId);
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0].charAt(0) + parts[1].charAt(0);
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Check if a player has pending matches (scheduled or to register)
  const playerHasPendingMatches = (userId: string): boolean => {
    return allMatches.some(match => {
      const isPlayerInvolved = match.winner_id === userId || match.loser_id === userId;
      if (!isPlayerInvolved) return false;

      // Check if it's a scheduled match (future or past to register)
      return match.is_scheduled;
    });
  };

  const handleOpenNewChallenge = () => {
    // Check if user has pending challenges or matches to register
    if (launchedChallenges.length > 0) {
      setBlockReason('launchedChallenge');
      setBlockReasonOpen(true);
      return;
    }

    if (scheduledMatches.length > 0) {
      setBlockReason('scheduled');
      setBlockReasonOpen(true);
      return;
    }

    if (matchesToRegister.length > 0) {
      setBlockReason('toRegister');
      setBlockReasonOpen(true);
      return;
    }

    // Open the dialog
    setNewChallengeOpen(true);
    setCurrentStep(1);
    setSelectedOpponent(null);
    setSelectedDate(undefined);
    setSelectedTime('');
    setSearchQuery('');
  };

  const handleCloseNewChallenge = () => {
    setNewChallengeOpen(false);
    setBlockReasonOpen(false);
    setBlockReason(null);
    setCurrentStep(1);
  };

  const handleCloseBlockReason = () => {
    setBlockReasonOpen(false);
    setBlockReason(null);
    setNewChallengeOpen(false);
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !selectedOpponent) {
      toast({
        title: 'Attenzione',
        description: 'Seleziona un avversario',
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 2 && !selectedDate) {
      toast({
        title: 'Attenzione',
        description: 'Seleziona una data',
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 3 && !selectedTime) {
      toast({
        title: 'Attenzione',
        description: 'Seleziona un orario',
        variant: 'destructive',
      });
      return;
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      handleCreateChallenge();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Navigation functions for Set Date/Time Dialog
  const handleDateTimeNextStep = () => {
    if (dateTimeStep === 1 && !selectedDate) {
      toast({
        title: 'Attenzione',
        description: 'Seleziona una data',
        variant: 'destructive',
      });
      return;
    }
    if (dateTimeStep === 2 && !selectedTime) {
      toast({
        title: 'Attenzione',
        description: 'Seleziona un orario',
        variant: 'destructive',
      });
      return;
    }

    if (dateTimeStep < 2) {
      setDateTimeStep(dateTimeStep + 1);
    } else {
      handleSetDateTime();
    }
  };

  const handleDateTimePrevStep = () => {
    if (dateTimeStep > 1) {
      setDateTimeStep(dateTimeStep - 1);
    }
  };

  const handleCreateChallenge = async () => {
    if (!selectedOpponent || !selectedDate || !selectedTime || !user?.id) {
      return;
    }

    try {
      const [hours, minutes] = selectedTime.split(':');
      const matchDateTime = new Date(selectedDate);
      matchDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const { error } = await supabase.from('matches').insert({
        championship_id: championshipId,
        winner_id: user.id,
        loser_id: selectedOpponent.user_id,
        played_at: matchDateTime.toISOString(),
        is_scheduled: true,
        score: 'Da giocare',
      });

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }

      toast({
        title: 'Successo',
        description: 'Sfida creata!',
      });

      handleCloseNewChallenge();
      fetchData();
    } catch (error: any) {
      console.error('❌ Error creating challenge:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile creare la sfida',
        variant: 'destructive',
      });
    }
  };

  const [matchToUpdate, setMatchToUpdate] = useState<Match | null>(null);

  const handleOpenRegisterResult = (matchToRegister?: Match) => {
    setRegisterResultOpen(true);
    setPlayer1Set1(null);
    setPlayer2Set1(null);
    setPlayer1Set2(null);
    setPlayer2Set2(null);
    setMatchResult(null);
    setMatchToUpdate(matchToRegister || null);

    if (matchToRegister && user) {
      const opponentId = matchToRegister.winner_id === user.id ? matchToRegister.loser_id : matchToRegister.winner_id;
      setResultOpponent(players.find(p => p.user_id === opponentId) || null);
    }
  };

  const handleCloseRegisterResult = () => {
    setRegisterResultOpen(false);
  };

  // Funzione per verificare se un set è completo
  const isSetComplete = (score1: number, score2: number): boolean => {
    // 6-0, 6-1, 6-2, 6-3, 6-4
    if ((score1 === 6 && score2 <= 4) || (score2 === 6 && score1 <= 4)) return true;
    // 7-5
    if ((score1 === 7 && score2 === 5) || (score2 === 7 && score1 === 5)) return true;
    // 7-6 (tiebreak)
    if ((score1 === 7 && score2 === 6) || (score2 === 7 && score1 === 6)) return true;
    return false;
  };

  // Funzione per validare un punteggio di set
  const isValidSetScore = (score1: number, score2: number): boolean => {
    // Max 6-6 per set incompleto
    if (score1 > 7 || score2 > 7) return false;
    // Se uno ha 7, l'altro deve avere 5 o 6
    if (score1 === 7 && score2 < 5) return false;
    if (score2 === 7 && score1 < 5) return false;
    return true;
  };

  // Funzione per calcolare il vincitore
  const calculateResult = () => {
    if (!resultOpponent || !user?.id) return;

    // Validazione: il primo set deve essere inserito
    if (player1Set1 === null || player2Set1 === null) {
      toast({
        title: 'Attenzione',
        description: 'Inserisci il punteggio del primo set',
        variant: 'destructive',
      });
      return;
    }

    // Validazione: il secondo set deve essere inserito
    if (player1Set2 === null || player2Set2 === null) {
      toast({
        title: 'Attenzione',
        description: 'Inserisci il punteggio del secondo set',
        variant: 'destructive',
      });
      return;
    }

    // Validazione punteggi realistici
    if (!isValidSetScore(player1Set1, player2Set1)) {
      toast({
        title: 'Punteggio non valido',
        description: 'Il punteggio del primo set non è realistico',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidSetScore(player1Set2, player2Set2)) {
      toast({
        title: 'Punteggio non valido',
        description: 'Il punteggio del secondo set non è realistico',
        variant: 'destructive',
      });
      return;
    }

    // Il primo set DEVE essere completo
    if (!isSetComplete(player1Set1, player2Set1)) {
      toast({
        title: 'Primo set incompleto',
        description: 'Il primo set deve essere concluso (es. 6-4, 7-5, 7-6)',
        variant: 'destructive',
      });
      return;
    }

    // Calcolo set vinti
    const player1WonSet1 = player1Set1 > player2Set1;
    const player1WonSet2 = isSetComplete(player1Set2, player2Set2) ? player1Set2 > player2Set2 : false;
    const player2WonSet1 = player2Set1 > player1Set1;
    const player2WonSet2 = isSetComplete(player1Set2, player2Set2) ? player2Set2 > player1Set2 : false;

    // Calcolo totale games + bonus
    let player1Total = player1Set1 + player1Set2;
    let player2Total = player2Set1 + player2Set2;

    // +2 bonus per ogni set COMPLETO vinto
    if (player1WonSet1) player1Total += 2;
    if (player1WonSet2) player1Total += 2;
    if (player2WonSet1) player2Total += 2;
    if (player2WonSet2) player2Total += 2;

    // Determina vincitore
    let winnerId: string;
    let loserId: string;
    let isDraw = false;

    if (player1Total > player2Total) {
      winnerId = user.id;
      loserId = resultOpponent.user_id;
    } else if (player2Total > player1Total) {
      winnerId = resultOpponent.user_id;
      loserId = user.id;
    } else {
      // Parità nei punti totali
      // Controlla se è 1-1 nei set (pareggio) o se uno ha vinto entrambi
      const player1SetsWon = (player1WonSet1 ? 1 : 0) + (player1WonSet2 ? 1 : 0);
      const player2SetsWon = (player2WonSet1 ? 1 : 0) + (player2WonSet2 ? 1 : 0);

      if (player1SetsWon === 1 && player2SetsWon === 1) {
        // 1-1 nei set con parità nei punti = PAREGGIO
        isDraw = true;
        winnerId = user.id; // Arbitrario per il database
        loserId = resultOpponent.user_id;
      } else if (player1WonSet1) {
        // Player1 ha vinto il primo set, quindi vince per spareggio
        winnerId = user.id;
        loserId = resultOpponent.user_id;
      } else {
        // Player2 ha vinto il primo set, quindi vince per spareggio
        winnerId = resultOpponent.user_id;
        loserId = user.id;
      }
    }

    // Costruisci score string (dal punto di vista del vincitore)
    let scoreStr: string;
    if (winnerId === user.id) {
      scoreStr = `${player1Set1}-${player2Set1} ${player1Set2}-${player2Set2}`;
    } else {
      scoreStr = `${player2Set1}-${player1Set1} ${player2Set2}-${player1Set2}`;
    }

    // Salva il risultato per il dialog di conferma
    const myName = players.find(p => p.user_id === user.id)?.display_name || 'Tu';

    setMatchResult({
      winnerId,
      loserId,
      score: scoreStr,
      isDraw,
      player1Total,
      player2Total,
      player1Name: myName,
      player2Name: resultOpponent.display_name
    });

    setConfirmDialogOpen(true);
  };

  const handleConfirmResult = async () => {
    if (!matchResult || !user?.id) return;

    try {
      let error;

      if (matchToUpdate) {
        const updateResult = await supabase
          .from('matches')
          .update({
            winner_id: matchResult.winnerId,
            loser_id: matchResult.loserId,
            score: matchResult.score,
            is_scheduled: false,
            played_at: new Date().toISOString(),
            is_draw: matchResult.isDraw,
          })
          .eq('id', matchToUpdate.id);

        error = updateResult.error;
      } else {
        const insertResult = await supabase.from('matches').insert({
          championship_id: championshipId,
          winner_id: matchResult.winnerId,
          loser_id: matchResult.loserId,
          played_at: new Date().toISOString(),
          is_scheduled: false,
          score: matchResult.score,
          is_draw: matchResult.isDraw,
        });

        error = insertResult.error;
      }

      if (error) throw error;

      toast({
        title: 'Successo',
        description: matchResult.isDraw ? 'Pareggio registrato!' : 'Risultato registrato!',
      });

      setConfirmDialogOpen(false);
      handleCloseRegisterResult();
      fetchData();
    } catch (error: any) {
      console.error('Error registering result:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile registrare il risultato',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteChallenge = async (matchId: string) => {
    if (!user?.id) return;

    try {
      // Prima ottieni i dati della sfida per inviare email
      const { data: matchData } = await supabase
        .from('matches')
        .select('*, championship_id, winner_id, loser_id, challenge_launcher_id')
        .eq('id', matchId)
        .single();

      if (!matchData) throw new Error('Sfida non trovata');

      // Ottieni i dati dei due giocatori
      const player1Id = matchData.winner_id;
      const player2Id = matchData.loser_id;

      const { data: player1Data } = await supabase
        .from('players')
        .select('display_name')
        .eq('user_id', player1Id)
        .eq('championship_id', matchData.championship_id)
        .single();

      const { data: player2Data } = await supabase
        .from('players')
        .select('display_name')
        .eq('user_id', player2Id)
        .eq('championship_id', matchData.championship_id)
        .single();

      // Ottieni email dei due giocatori
      const { data: player1Email } = await supabase.rpc('get_user_email', {
        p_user_id: player1Id
      });
      const { data: player2Email } = await supabase.rpc('get_user_email', {
        p_user_id: player2Id
      });

      // Elimina la sfida
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (error) throw error;

      // Invia email a entrambi i giocatori
      const currentPlayerData = await supabase
        .from('players')
        .select('display_name')
        .eq('user_id', user.id)
        .eq('championship_id', matchData.championship_id)
        .single();

      const currentPlayerName = currentPlayerData?.data?.display_name?.split(' ')[0] || 'Un giocatore';

      if (player1Email && player1Id !== user.id) {
        await sendChallengeEmail({
          to: player1Email,
          recipientName: player1Data?.display_name?.split(' ')[0] || 'Giocatore',
          senderName: currentPlayerName,
          challengeType: 'deleted' as any,
          matchId: matchId,
        });
      }

      if (player2Email && player2Id !== user.id) {
        await sendChallengeEmail({
          to: player2Email,
          recipientName: player2Data?.display_name?.split(' ')[0] || 'Giocatore',
          senderName: currentPlayerName,
          challengeType: 'deleted' as any,
          matchId: matchId,
        });
      }

      toast({
        title: 'Successo',
        description: 'Sfida eliminata!',
      });

      fetchData();
    } catch (error: any) {
      console.error('❌ Error deleting challenge:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile eliminare la sfida',
        variant: 'destructive',
      });
    }
  };

  // Launch Challenge Functions
  const handleOpenLaunchChallenge = () => {
    // Check constraints
    if (launchedChallenges.length > 0) {
      setBlockReason('launchedChallenge');
      setBlockReasonOpen(true);
      return;
    }

    if (scheduledMatches.length > 0) {
      setBlockReason('scheduled');
      setBlockReasonOpen(true);
      return;
    }

    if (matchesToRegister.length > 0) {
      setBlockReason('toRegister');
      setBlockReasonOpen(true);
      return;
    }

    setLaunchChallengeOpen(true);
    setSelectedOpponent(null);
    setSearchQuery('');
  };

  const handleLaunchChallenge = async () => {
    if (!selectedOpponent || !user?.id) return;

    try {
      const { data: newMatch, error } = await supabase.from('matches')
        .insert({
          championship_id: championshipId,
          winner_id: user.id,
          loser_id: selectedOpponent.user_id,
          played_at: new Date().toISOString(),
          is_scheduled: false,
          score: 'In attesa',
          challenge_status: 'lanciata',
          challenge_launcher_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Ottieni dati utente corrente
      const { data: userData } = await supabase
        .from('players')
        .select('display_name')
        .eq('user_id', user.id)
        .eq('championship_id', championshipId)
        .single();

      // Ottieni email dell'avversario
      const { data: opponentEmail } = await supabase.rpc('get_user_email', {
        p_user_id: selectedOpponent.user_id
      });

      // Invia email all'avversario
      if (opponentEmail) {
        await sendChallengeEmail({
          to: opponentEmail,
          recipientName: selectedOpponent.display_name.split(' ')[0],
          senderName: userData?.display_name?.split(' ')[0] || 'Un giocatore',
          challengeType: 'launched',
          matchId: newMatch?.id,
        });
      }

      toast({
        title: 'Successo',
        description: 'Sfida lanciata! L\'avversario può ora accettare.',
      });

      setLaunchChallengeOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('❌ Error launching challenge:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile lanciare la sfida',
        variant: 'destructive',
      });
    }
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    if (!user?.id) return;

    try {
      // Prima ottieni i dati della sfida
      const { data: challengeData } = await supabase
        .from('matches')
        .select('*, challenge_launcher_id')
        .eq('id', challengeId)
        .single();

      const { data, error } = await supabase.rpc('accept_challenge', {
        p_challenge_id: challengeId,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data.success) {
        // Ottieni dati dei due giocatori
        const { data: accepterData } = await supabase
          .from('players')
          .select('display_name')
          .eq('user_id', user.id)
          .eq('championship_id', challengeData?.championship_id)
          .single();

        const { data: launcherData } = await supabase
          .from('players')
          .select('display_name')
          .eq('user_id', challengeData?.challenge_launcher_id)
          .eq('championship_id', challengeData?.championship_id)
          .single();

        // Ottieni email del launcher
        const { data: launcherEmail } = await supabase.rpc('get_user_email', {
          p_user_id: challengeData?.challenge_launcher_id
        });

        // Invia email al giocatore che ha lanciato la sfida
        if (launcherEmail) {
          await sendChallengeEmail({
            to: launcherEmail,
            recipientName: launcherData?.display_name?.split(' ')[0] || 'Giocatore',
            senderName: accepterData?.display_name?.split(' ')[0] || 'Giocatore',
            challengeType: 'accepted',
            matchId: challengeId,
          });
        }

        toast({
          title: 'Successo',
          description: 'Sfida accettata! Ora puoi impostare data e ora.',
        });
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('❌ Error accepting challenge:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile accettare la sfida',
        variant: 'destructive',
      });
    }
  };

  const handleRejectChallenge = async (challengeId: string) => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.rpc('reject_challenge', {
        p_challenge_id: challengeId,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Successo',
          description: 'Sfida rifiutata',
        });
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('❌ Error rejecting challenge:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile rifiutare la sfida',
        variant: 'destructive',
      });
    }
  };

  const handleOpenSetDateTime = (challenge: Match) => {
    setSelectedChallengeForDateTime(challenge);

    // Pre-populate with existing date and time if available
    const matchDate = new Date(challenge.played_at);
    setSelectedDate(matchDate);
    setSelectedTime(format(matchDate, 'HH:mm'));

    setDateTimeStep(1); // Reset to first step
    setSetDateTimeOpen(true);
  };

  const handleSetDateTime = async () => {
    if (!selectedChallengeForDateTime || !selectedDate || !selectedTime || !user?.id) return;

    try {
      const [hours, minutes] = selectedTime.split(':');
      const matchDateTime = new Date(selectedDate);
      matchDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const { data, error } = await supabase.rpc('set_challenge_datetime', {
        p_challenge_id: selectedChallengeForDateTime.id,
        p_user_id: user.id,
        p_datetime: matchDateTime.toISOString(),
      });

      if (error) throw error;

      if (data.success) {
        // Ottieni dati dei due giocatori
        const player1Id = selectedChallengeForDateTime.winner_id;
        const player2Id = selectedChallengeForDateTime.loser_id;

        const { data: player1Data } = await supabase
          .from('players')
          .select('display_name')
          .eq('user_id', player1Id)
          .eq('championship_id', selectedChallengeForDateTime.championship_id)
          .single();

        const { data: player2Data } = await supabase
          .from('players')
          .select('display_name')
          .eq('user_id', player2Id)
          .eq('championship_id', selectedChallengeForDateTime.championship_id)
          .single();

        // Ottieni email di entrambi i giocatori
        const { data: player1Email } = await supabase.rpc('get_user_email', {
          p_user_id: player1Id
        });
        const { data: player2Email } = await supabase.rpc('get_user_email', {
          p_user_id: player2Id
        });

        const formattedDate = formatDateForEmail(matchDateTime);
        const formattedTime = formatTimeForEmail(matchDateTime);

        // Invia email a entrambi i giocatori
        if (player1Email) {
          await sendChallengeEmail({
            to: player1Email,
            recipientName: player1Data?.display_name?.split(' ')[0] || 'Giocatore',
            senderName: player2Data?.display_name?.split(' ')[0] || 'Giocatore',
            challengeType: 'scheduled',
            matchDate: formattedDate,
            matchTime: formattedTime,
            matchId: selectedChallengeForDateTime.id,
          });
        }

        if (player2Email) {
          await sendChallengeEmail({
            to: player2Email,
            recipientName: player2Data?.display_name?.split(' ')[0] || 'Giocatore',
            senderName: player1Data?.display_name?.split(' ')[0] || 'Giocatore',
            challengeType: 'scheduled',
            matchDate: formattedDate,
            matchTime: formattedTime,
            matchId: selectedChallengeForDateTime.id,
          });
        }

        const isModifying = selectedChallengeForDateTime.is_scheduled;
        toast({
          title: 'Successo',
          description: isModifying
            ? 'Data e ora modificate con successo!'
            : 'Data e ora impostate! La sfida è ora programmata.',
        });
        setSetDateTimeOpen(false);
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('❌ Error setting date/time:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile impostare data e ora',
        variant: 'destructive',
      });
    }
  };

  const getWhatsAppLink = (challenge: Match): string => {
    const opponentId = challenge.winner_id === user?.id ? challenge.loser_id : challenge.winner_id;
    const opponentPlayer = players.find(p => p.user_id === opponentId);
    const opponentFullName = opponentPlayer?.display_name || 'avversario';
    // Extract first name only (everything before the first space)
    const opponentFirstName = opponentFullName.split(' ')[0];
    const phone = opponentPlayer?.phone;

    if (!phone) return '';

    // Remove all non-digit characters except the leading +
    const cleanPhone = phone.startsWith('+') ? phone.replace(/[^\d+]/g, '') : phone.replace(/\D/g, '');

    let message = '';
    if (challenge.challenge_status === 'lanciata') {
      message = `Ciao ${opponentFirstName}, ti ho lanciato una sfida su Tennis Race. Se sei d\'accordo, accettala sull\'app!`;
    } else if (challenge.challenge_status === 'accettata') {
      message = `Ciao ${opponentFirstName}, per la nostra sfida su Tennis Race, mettiamoci d\'accordo su data e orario!`;
    } else if (challenge.is_scheduled && !challenge.challenge_status) {
      const matchDate = new Date(challenge.played_at);
      const formattedDate = format(matchDate, 'dd MMMM', { locale: it });
      const formattedTime = format(matchDate, 'HH:mm', { locale: it });
      message = `Ciao ${opponentFirstName}, ti ricordo la nostra partita programmata per il ${formattedDate} alle ${formattedTime}. Ci vediamo!`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleScoreInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    // Workaround for mobile keyboards covering the input on subsequent focuses.
    // We manually scroll the focused element into the center of the view.
    if (window.innerWidth < 768) { // Simple check for mobile devices
      setTimeout(() => {
        event.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300); // Delay to allow keyboard to animate in
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    return slots;
  };

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
    <div className="p-6 pb-24 space-y-6 bg-gradient-to-br from-tennis-court/5 via-background to-tennis-ball/5 min-h-full">
      <div>
        <h1 className="text-3xl font-bold text-tennis-court">Sfide</h1>
        <p className="text-muted-foreground">Gestione partite e risultati</p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={handleOpenLaunchChallenge}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg"
        >
          <Send className="h-5 w-5 mr-2" />
          Lancia Sfida
        </Button>
        <Button
          onClick={handleOpenNewChallenge}
          className="w-full bg-tennis-court hover:bg-tennis-court/90 text-white h-14 text-lg"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nuova Sfida
        </Button>
      </div>

      {/* Launched Challenges */}
      {launchedChallenges.length > 0 && (
        <Card className="border-blue-500/50 bg-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Send className="h-5 w-5" />
              Sfide Lanciate
              <Badge variant="outline" className="ml-2 border-white text-white">
                {launchedChallenges.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {launchedChallenges.map((challenge) => {
              const isLauncher = challenge.challenge_launcher_id === user?.id;
              const opponentId = challenge.winner_id === user?.id ? challenge.loser_id : challenge.winner_id;
              const whatsappLink = getWhatsAppLink(challenge);

              return (
                <div
                  key={challenge.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    challenge.challenge_status === 'accettata'
                      ? 'border-green-400 bg-white/20'
                      : 'border-blue-400 bg-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Center: Avatar and Name */}
                    <div className="flex items-center gap-3 flex-1 justify-center">
                      <Avatar className="h-12 w-12 shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                        {getPlayerAvatar(opponentId) ? (
                          <img
                            src={getPlayerAvatar(opponentId)!}
                            alt={getPlayerName(opponentId)}
                            className="object-cover"
                          />
                        ) : (
                          <AvatarFallback className="bg-white/30 text-white">
                            {getPlayerInitials(opponentId)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="font-medium text-white">{getPlayerName(opponentId)}</div>
                    </div>

                    {/* Right side: Action Buttons stacked vertically */}
                    <div className="flex flex-col gap-2 items-end">
                      {/* Accept/Reject for opponent */}
                      {challenge.challenge_status === 'lanciata' && !isLauncher && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAcceptChallenge(challenge.id)}
                            className="w-full bg-green-500 hover:bg-green-600"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Accetta
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRejectChallenge(challenge.id)}
                            className="w-full bg-red-600 hover:bg-red-700"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rifiuta
                          </Button>
                        </>
                      )}

                      {/* Set Date/Time for accepted challenges */}
                      {challenge.challenge_status === 'accettata' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleOpenSetDateTime(challenge)}
                          className="w-full bg-tennis-court hover:bg-tennis-court/90"
                        >
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          Data
                        </Button>
                      )}

                      {/* WhatsApp Button */}
                      {whatsappLink && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(whatsappLink, '_blank')}
                          className="w-full bg-[#25D366] hover:bg-[#20BA5A] border-0 text-white"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 fill-white mr-1"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                          </svg>
                          WhatsApp
                        </Button>
                      )}

                      {/* Delete Button */}
                      {(
                        (challenge.challenge_status === 'lanciata' && isLauncher) ||
                        challenge.challenge_status === 'accettata'
                      ) && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteChallenge(challenge.id)}
                          className="w-full bg-red-600 hover:bg-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Match da Registrare */}
      {matchesToRegister.length > 0 && (
        <Card className="border-red-500/50 bg-red-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileCheck className="h-5 w-5" />
              Partite da Registrare
              <Badge variant="outline" className="ml-2 border-white text-white">
                {matchesToRegister.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {matchesToRegister.map((match) => {
              const player1Id = match.winner_id;
              const player2Id = match.loser_id;
              const matchDate = new Date(match.played_at);

              return (
                <div key={match.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-2">
                    <CalendarIcon className="h-4 w-4 text-white/70" />
                    <p className="text-xs text-white/70 font-medium">
                      {format(matchDate, 'PPP', { locale: it })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-white/20 rounded-lg border-l-4 border-red-400">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar className="h-12 w-12 shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                          {getPlayerAvatar(player1Id) ? (
                            <img
                              src={getPlayerAvatar(player1Id)!}
                              alt={getPlayerName(player1Id)}
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="bg-white/30 text-white">
                              {getPlayerInitials(player1Id)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <div className="font-medium text-white">{getPlayerName(player1Id)}</div>
                          {player1Id === user?.id && (
                            <Badge variant="outline" className="text-xs mt-1 border-white text-white">Tu</Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-6 my-1">
                        <div className="h-px bg-white/30 flex-1"></div>
                        <span className="text-xs text-white font-semibold">VS</span>
                        <div className="h-px bg-white/30 flex-1"></div>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <Avatar className="h-12 w-12 shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                          {getPlayerAvatar(player2Id) ? (
                            <img
                              src={getPlayerAvatar(player2Id)!}
                              alt={getPlayerName(player2Id)}
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="bg-white/30 text-white">
                              {getPlayerInitials(player2Id)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <div className="font-medium text-white">{getPlayerName(player2Id)}</div>
                          {player2Id === user?.id && (
                            <Badge variant="outline" className="text-xs mt-1 border-white text-white">Tu</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        size="lg"
                        className="bg-tennis-court hover:bg-tennis-court/90 min-w-[120px]"
                        onClick={() => handleOpenRegisterResult(match)}
                      >
                        <FileCheck className="h-4 w-4 mr-2" />
                        Registra
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteChallenge(match.id)}
                        className="w-full bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Elimina
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Scheduled Matches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-tennis-court" />
            Sfide Programmate
            {scheduledMatches.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {scheduledMatches.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheduledMatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Swords className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna sfida programmata</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledMatches.map((match) => {
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
                        <Avatar className="h-12 w-12 shadow-[0_0_15px_rgba(139,195,74,0.4)]">
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
                          <div className="font-medium">{getPlayerName(player1Id)}</div>
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
                        <Avatar className="h-12 w-12 shadow-[0_0_15px_rgba(139,195,74,0.4)]">
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
                          <div className="font-medium">{getPlayerName(player2Id)}</div>
                          {player2Id === user?.id && (
                            <Badge variant="outline" className="text-xs mt-1">Tu</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-2 bg-tennis-court/10 rounded-lg border border-tennis-court/20 min-w-[120px]">
                        <CalendarIcon className="h-5 w-5 text-tennis-court" />
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
                      {getWhatsAppLink(match) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getWhatsAppLink(match), '_blank')}
                          className="w-full bg-[#25D366] hover:bg-[#20BA5A] border-0 text-white"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 fill-white mr-1"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                          </svg>
                          WhatsApp
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenSetDateTime(match)}
                        className="w-full bg-tennis-court hover:bg-tennis-court/90 text-white border-0"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Modifica
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteChallenge(match.id)}
                        className="w-full bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Elimina
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match da Registrare */}
      {matchesToRegister.length > 0 && (
        <Card className="border-red-500/50 bg-red-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileCheck className="h-5 w-5" />
              Partite da Registrare
              <Badge variant="outline" className="ml-2 border-white text-white">
                {matchesToRegister.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {matchesToRegister.map((match) => {
              const player1Id = match.winner_id;
              const player2Id = match.loser_id;
              const matchDate = new Date(match.played_at);
              
              return (
                <div key={match.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-2">
                    <CalendarIcon className="h-4 w-4 text-white/70" />
                    <p className="text-xs text-white/70 font-medium">
                      {format(matchDate, 'PPP', { locale: it })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-white/20 rounded-lg border-l-4 border-red-400">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar className="h-12 w-12 shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                          {getPlayerAvatar(player1Id) ? (
                            <img
                              src={getPlayerAvatar(player1Id)!}
                              alt={getPlayerName(player1Id)}
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="bg-white/30 text-white">
                              {getPlayerInitials(player1Id)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <div className="font-medium text-white">{getPlayerName(player1Id)}</div>
                          {player1Id === user?.id && (
                            <Badge variant="outline" className="text-xs mt-1 border-white text-white">Tu</Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-6 my-1">
                        <div className="h-px bg-white/30 flex-1"></div>
                        <span className="text-xs text-white font-semibold">VS</span>
                        <div className="h-px bg-white/30 flex-1"></div>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <Avatar className="h-12 w-12 shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                          {getPlayerAvatar(player2Id) ? (
                            <img
                              src={getPlayerAvatar(player2Id)!}
                              alt={getPlayerName(player2Id)}
                              className="object-cover"
                            />
                          ) : (
                            <AvatarFallback className="bg-white/30 text-white">
                              {getPlayerInitials(player2Id)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <div className="font-medium text-white">{getPlayerName(player2Id)}</div>
                          {player2Id === user?.id && (
                            <Badge variant="outline" className="text-xs mt-1 border-white text-white">Tu</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        size="lg"
                        className="bg-orange-600 hover:bg-orange-700 min-w-[120px]"
                        onClick={() => handleOpenRegisterResult(match)}
                      >
                        <FileCheck className="h-4 w-4 mr-2" />
                        Registra
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteChallenge(match.id)}
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Elimina
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Match History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-tennis-court" />
            Storico Partite
            {matchHistory.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {matchHistory.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {matchHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna partita giocata</p>
            </div>
          ) : (
            <div className="space-y-2">
              {matchHistory.map((match) => {
                const isWinner = match.winner_id === user?.id;
                
                return (
                  <div
                    key={match.id} 
                    className={`p-3 rounded-lg ${
                      isWinner
                        ? 'bg-green-500/10 border border-green-500/20'
                        : 'bg-red-500/10 border border-red-500/20'
                    } space-y-2`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Trophy className={`h-5 w-5 ${
                          isWinner 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`} />
                        <div>
                          <p className="font-medium text-sm">
                            {`${isWinner ? 'Vittoria' : 'Sconfitta'} vs ${getPlayerName(isWinner ? match.loser_id : match.winner_id)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(match.played_at), 'd MMMM', { locale: it })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={isWinner ? "default" : "secondary"}>
                        {match.score}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {fullMatchHistory.length > 3 && (
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setFullHistoryOpen(true)}
                >
                  Vedi tutti i risultati
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Challenge Dialog */}
      <Dialog open={newChallengeOpen} onOpenChange={setNewChallengeOpen}>
        <DialogContent className="w-[95vw] max-w-2xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2 border-b">
            <DialogTitle className="text-2xl text-tennis-court mb-4">
              Nuova Sfida
            </DialogTitle>

            {/* Progress Bar */}
            <div className="space-y-4 pb-4">
              {/* Progress Steps */}
              <div className="flex items-center gap-2">
                {/* Step 1 */}
                <div className="flex items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base transition-all ${
                    currentStep > 1
                      ? 'bg-tennis-court text-white'
                      : currentStep === 1
                        ? 'bg-tennis-court text-white ring-4 ring-tennis-court/20'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {currentStep > 1 ? <Check className="h-5 w-5" /> : '1'}
                  </div>
                  <div className={`flex-1 h-1.5 mx-2 rounded-full transition-all ${
                    currentStep > 1 ? 'bg-tennis-court' : 'bg-muted'
                  }`} />
                </div>

                {/* Step 2 */}
                <div className="flex items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base transition-all ${
                    currentStep > 2
                      ? 'bg-tennis-court text-white'
                      : currentStep === 2
                        ? 'bg-tennis-court text-white ring-4 ring-tennis-court/20'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {currentStep > 2 ? <Check className="h-5 w-5" /> : '2'}
                  </div>
                  <div className={`flex-1 h-1.5 mx-2 rounded-full transition-all ${
                    currentStep > 2 ? 'bg-tennis-court' : 'bg-muted'
                  }`} />
                </div>

                {/* Step 3 */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base transition-all ${
                  currentStep === 3
                    ? 'bg-tennis-court text-white ring-4 ring-tennis-court/20'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  3
                </div>
              </div>

              {/* Step Labels */}
              <div className="flex items-center gap-2">
                {/* Label 1 */}
                <div className="flex-1 flex items-center">
                  <div className="w-10 flex justify-center">
                    <span className={`text-sm font-semibold transition-colors ${
                      currentStep >= 1 ? 'text-tennis-court' : 'text-muted-foreground'
                    }`}>
                      Avversario
                    </span>
                  </div>
                  <div className="flex-1 mx-2" />
                </div>

                {/* Label 2 */}
                <div className="flex-1 flex items-center">
                  <div className="w-10 flex justify-center">
                    <span className={`text-sm font-semibold transition-colors ${
                      currentStep >= 2 ? 'text-tennis-court' : 'text-muted-foreground'
                    }`}>
                      Data
                    </span>
                  </div>
                  <div className="flex-1 mx-2" />
                </div>

                {/* Label 3 */}
                <div className="w-10 flex justify-center">
                  <span className={`text-sm font-semibold transition-colors ${
                    currentStep >= 3 ? 'text-tennis-court' : 'text-muted-foreground'
                  }`}>
                    Orario
                  </span>
                </div>
              </div>
            </div>

            <DialogDescription className="sr-only">
              Crea una nuova sfida selezionando un avversario, una data e un orario.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Step 1: Select Opponent */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Seleziona Avversario</Label>
                <Input
                  placeholder="Cerca giocatore..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-4"
                />
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {filteredPlayers.map((player) => {
                    const hasPendingMatches = playerHasPendingMatches(player.user_id);
                    const isDisabled = hasPendingMatches;

                    return (
                      <div
                        key={player.id}
                        onClick={() => {
                          if (isDisabled) {
                            toast({
                              title: 'Avversario non disponibile',
                              description: `${player.display_name} ha già una sfida programmata o un match da registrare`,
                              variant: 'destructive',
                            });
                            return;
                          }
                          setSelectedOpponent(player);
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          isDisabled
                            ? 'opacity-50 cursor-not-allowed bg-gray-100'
                            : selectedOpponent?.id === player.id
                              ? 'bg-tennis-court/20 border-2 border-tennis-court cursor-pointer'
                              : 'bg-muted/50 hover:bg-muted cursor-pointer'
                        }`}
                      >
                        <Avatar className="h-12 w-12">
                          {player.avatar_url ? (
                            <img src={player.avatar_url} alt={player.display_name} className="object-cover" />
                          ) : (
                            <AvatarFallback>{getPlayerInitials(player.user_id)}</AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">{player.display_name}</p>
                          {isDisabled && (
                            <Badge variant="outline" className="mt-1 text-xs border-red-300 text-red-600">
                              Non disponibile
                            </Badge>
                          )}
                        </div>
                        {selectedOpponent?.id === player.id && !isDisabled && (
                          <CheckCircle className="h-5 w-5 text-tennis-court ml-auto" />
                        )}
                        {isDisabled && (
                          <XCircle className="h-5 w-5 text-red-500 ml-auto" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Select Date */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Seleziona Data</Label>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const compareDate = new Date(date);
                      compareDate.setHours(0, 0, 0, 0);
                      return compareDate < today;
                    }}
                    className="rounded-md border"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Select Time */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Seleziona Orario</Label>
                <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
                  {generateTimeSlots().map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedTime(time);
                      }}
                      className={selectedTime === time ? 'bg-tennis-court hover:bg-tennis-court/90' : ''}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fixed Bottom Navigation */}
          <div className="flex justify-between gap-3 px-6 py-4 border-t bg-background">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handlePrevStep}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Indietro
              </Button>
            )}
            <Button
              onClick={handleNextStep}
              className="ml-auto bg-tennis-court hover:bg-tennis-court/90"
            >
              {currentStep === 3 ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Conferma Sfida
                </>
              ) : (
                <>
                  Avanti
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Register Result Dialog */}
      <Dialog open={registerResultOpen} onOpenChange={setRegisterResultOpen}>
        <DialogContent className="w-[95vw] max-w-2xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-2xl text-tennis-court">Registra Risultato</DialogTitle>
            <DialogDescription className="sr-only">
              Registra il risultato di una partita, specificando il vincitore e il punteggio.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
            {!matchToUpdate && (
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Seleziona Avversario</Label>
                <Input
                  placeholder="Cerca giocatore..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-4"
                />
                <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                  {filteredPlayers.map((player) => (
                    <div
                      key={player.id}
                      onClick={() => setResultOpponent(player)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        resultOpponent?.id === player.id
                          ? 'bg-tennis-court/20 border-2 border-tennis-court'
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <Avatar className="h-10 w-10">
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt={player.display_name} className="object-cover" />
                        ) : (
                          <AvatarFallback>{getPlayerInitials(player.user_id)}</AvatarFallback>
                        )}
                      </Avatar>
                      <p className="font-medium">{player.display_name}</p>
                      {resultOpponent?.id === player.id && (
                        <CheckCircle className="h-5 w-5 text-tennis-court ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show opponent if from scheduled match */}
            {matchToUpdate && resultOpponent && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <Label className="text-sm text-muted-foreground">Avversario</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Avatar className="h-12 w-12">
                    {resultOpponent.avatar_url ? (
                      <img src={resultOpponent.avatar_url} alt={resultOpponent.display_name} className="object-cover" />
                    ) : (
                      <AvatarFallback>{getPlayerInitials(resultOpponent.user_id)}</AvatarFallback>
                    )}
                  </Avatar>
                  <p className="font-semibold text-lg">{resultOpponent.display_name}</p>
                </div>
              </div>
            )}

            {/* Score Input by Player */}
            {resultOpponent && (
              <div className="space-y-6">
                <Label className="text-lg font-semibold">Punteggio</Label>

                {/* Header con nomi giocatori */}
                <div className="grid grid-cols-3 gap-2 items-center">
                  <div></div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-tennis-court">Tu</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-muted-foreground">{resultOpponent.display_name}</p>
                  </div>
                </div>

                {/* Set 1 */}
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Label className="text-sm text-muted-foreground">1° Set</Label>
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    placeholder="6"
                    value={player1Set1 ?? ''}
                    onChange={(e) => setPlayer1Set1(e.target.value ? parseInt(e.target.value) : null)}
                    onFocus={handleScoreInputFocus}
                    className="text-center text-lg font-bold"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    placeholder="4"
                    value={player2Set1 ?? ''}
                    onChange={(e) => setPlayer2Set1(e.target.value ? parseInt(e.target.value) : null)}
                    onFocus={handleScoreInputFocus}
                    className="text-center text-lg font-bold"
                  />
                </div>

                {/* Set 2 */}
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Label className="text-sm text-muted-foreground">2° Set</Label>
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    placeholder="6"
                    value={player1Set2 ?? ''}
                    onChange={(e) => setPlayer1Set2(e.target.value ? parseInt(e.target.value) : null)}
                    onFocus={handleScoreInputFocus}
                    className="text-center text-lg font-bold"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    placeholder="3"
                    value={player2Set2 ?? ''}
                    onChange={(e) => setPlayer2Set2(e.target.value ? parseInt(e.target.value) : null)}
                    onFocus={handleScoreInputFocus}
                    className="text-center text-lg font-bold"
                  />
                </div>

                {/* Info algoritmo */}
                <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                  <p>Il vincitore viene calcolato automaticamente in base ai games vinti (+2 per ogni set completo). In caso di parità vince chi ha vinto il primo set.</p>
                </div>
              </div>
            )}
            </div>
          </ScrollArea>

          {/* Fixed Bottom Button */}
          {resultOpponent && (
            <div className="px-6 py-4 border-t bg-background">
              <Button
                onClick={calculateResult}
                className="w-full bg-tennis-court hover:bg-tennis-court/90 h-12"
              >
                <Check className="h-5 w-5 mr-2" />
                Registra Risultato
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Match History Dialog */}
      <Dialog open={fullHistoryOpen} onOpenChange={setFullHistoryOpen}>
        <DialogContent className="w-[95vw] max-w-5xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-2xl text-tennis-court">Storico Completo</DialogTitle>
            <DialogDescription>
              Visualizza e filtra tutte le tue partite giocate
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="px-6 pt-4 pb-2 space-y-3 border-b">
            {/* Time Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={historyFilterType} onValueChange={(value) => setHistoryFilterType(value as 'month' | 'year' | 'all')}>
                <TabsList>
                  <TabsTrigger value="month">Mensile</TabsTrigger>
                  <TabsTrigger value="year">Annuale</TabsTrigger>
                  <TabsTrigger value="all">Tutto</TabsTrigger>
                </TabsList>
              </Tabs>

              {historyFilterType !== 'all' && (
                <Select value={historySelectedYear.toString()} onValueChange={(value) => setHistorySelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {historyFilterType === 'month' && (
                <Select value={historySelectedMonth.toString()} onValueChange={(value) => setHistorySelectedMonth(parseInt(value))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Result Filter */}
            <div className="flex gap-2">
              <Button
                variant={historyResultFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHistoryResultFilter('all')}
                className={historyResultFilter === 'all' ? 'bg-tennis-court hover:bg-tennis-court/90' : ''}
              >
                Tutte
              </Button>
              <Button
                variant={historyResultFilter === 'win' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHistoryResultFilter('win')}
                className={historyResultFilter === 'win' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                Vittorie
              </Button>
              <Button
                variant={historyResultFilter === 'loss' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHistoryResultFilter('loss')}
                className={historyResultFilter === 'loss' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                Sconfitte
              </Button>
              <Button
                variant={historyResultFilter === 'draw' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHistoryResultFilter('draw')}
                className={historyResultFilter === 'draw' ? 'bg-gray-600 hover:bg-gray-700' : ''}
              >
                Pareggi
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 px-6">
            <div className="py-4 space-y-3">
              {enhancedFilteredHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Nessuna partita trovata</p>
                  <p className="text-sm">Nessun risultato corrisponde ai filtri selezionati</p>
                </div>
              ) : (
                enhancedFilteredHistory.map((match) => {
                  const isDraw = match.is_draw;
                  const isWinner = !isDraw && match.winner_id === user?.id;
                  const winnerId = match.winner_id;
                  const loserId = match.loser_id;
                  const matchDate = new Date(match.played_at);

                  // Get player data
                  const winnerPlayer = players.find(p => p.user_id === winnerId);
                  const loserPlayer = players.find(p => p.user_id === loserId);

                  // Parse score
                  const sets = match.score.split(' ').filter(s => s.trim() !== '');

                  // Determine border color based on result
                  const borderColor = isDraw
                    ? 'border-gray-400'
                    : isWinner
                    ? 'border-green-600'
                    : 'border-red-600';

                  const backgroundColor = isDraw
                    ? 'bg-gray-50 dark:bg-gray-950/20'
                    : isWinner
                    ? 'bg-green-50 dark:bg-green-950/20'
                    : 'bg-red-50 dark:bg-red-950/20';

                  return (
                    <div key={match.id} className="space-y-2">
                      {/* Date Header */}
                      <div className="flex items-center gap-2 px-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground font-medium">
                          {format(matchDate, 'PPP', { locale: it })}
                        </p>
                      </div>

                      {/* Match Card */}
                      <div className={`flex items-center gap-4 p-4 rounded-lg border-l-4 ${borderColor} ${backgroundColor}`}>
                        {/* Players Column */}
                        <div className="flex-1">
                          {/* Winner/Player 1 */}
                          <div className="flex items-center gap-3 mb-2">
                            <Avatar className={`h-12 w-12 ${!isDraw && isWinner ? 'shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'shadow-[0_0_10px_rgba(0,0,0,0.2)]'}`}>
                              {winnerPlayer?.avatar_url ? (
                                <img
                                  src={winnerPlayer.avatar_url}
                                  alt={winnerPlayer.display_name}
                                  className="object-cover"
                                />
                              ) : (
                                <AvatarFallback className={!isDraw && isWinner ? 'bg-green-600/10 text-green-600' : 'bg-muted'}>
                                  {getPlayerInitials(winnerId)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {getPlayerName(winnerId)}
                                {winnerId === user?.id && (
                                  <Badge variant="outline" className="ml-2 text-xs">Tu</Badge>
                                )}
                              </p>
                              {!isDraw && (
                                <Badge variant="default" className="text-xs mt-1 bg-green-600">Vincitore</Badge>
                              )}
                            </div>
                          </div>

                          {/* VS Divider */}
                          <div className="flex items-center gap-2 ml-6 my-1">
                            <div className="h-px bg-border flex-1"></div>
                            <span className="text-xs text-muted-foreground font-semibold">VS</span>
                            <div className="h-px bg-border flex-1"></div>
                          </div>

                          {/* Loser/Player 2 */}
                          <div className="flex items-center gap-3 mt-2">
                            <Avatar className="h-12 w-12 shadow-[0_0_10px_rgba(0,0,0,0.2)]">
                              {loserPlayer?.avatar_url ? (
                                <img
                                  src={loserPlayer.avatar_url}
                                  alt={loserPlayer.display_name}
                                  className="object-cover"
                                />
                              ) : (
                                <AvatarFallback className="bg-muted">
                                  {getPlayerInitials(loserId)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {getPlayerName(loserId)}
                                {loserId === user?.id && (
                                  <Badge variant="outline" className="ml-2 text-xs">Tu</Badge>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Score Column */}
                        <div className={`flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-lg border min-w-[120px] ${
                          isDraw
                            ? 'bg-gray-400/10 border-gray-400/20'
                            : isWinner
                            ? 'bg-green-600/10 border-green-600/20'
                            : 'bg-red-600/10 border-red-600/20'
                        }`}>
                          {/* Winner scores (or Player 1 scores if draw) */}
                          <div className="flex items-center gap-2 justify-end w-full">
                            {sets.map((set, index) => {
                              const [winnerScore] = set.split('-');
                              return (
                                <span key={index} className={`text-xl font-bold w-8 text-center font-mono ${
                                  isDraw ? 'text-gray-600' : isWinner ? 'text-green-600' : 'text-muted-foreground'
                                }`}>
                                  {winnerScore}
                                </span>
                              );
                            })}
                            <div className="w-6 ml-1">
                              {!isDraw && isWinner && <Trophy className="h-5 w-5 text-green-600" />}
                              {!isDraw && !isWinner && <Trophy className="h-5 w-5 text-red-600" />}
                            </div>
                          </div>
                          {/* Loser scores (or Player 2 scores if draw) */}
                          <div className="flex items-center gap-2 justify-end w-full">
                            {sets.map((set, index) => {
                              const [, loserScore] = set.split('-');
                              return (
                                <span key={index} className={`text-xl font-semibold w-8 text-center font-mono ${
                                  isDraw ? 'text-gray-600' : !isWinner ? 'text-red-600' : 'text-muted-foreground'
                                }`}>
                                  {loserScore}
                                </span>
                              );
                            })}
                            <div className="w-6 ml-1">
                              {/* Empty space for alignment */}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-tennis-court">Conferma Risultato</DialogTitle>
            <DialogDescription>
              Verifica i dati prima di confermare
            </DialogDescription>
          </DialogHeader>

          {matchResult && (
            <div className="space-y-4 py-4">
              {/* Risultato */}
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                {matchResult.isDraw ? (
                  <div>
                    <p className="text-2xl font-bold text-orange-600">PAREGGIO</p>
                    <p className="text-sm text-muted-foreground mt-1">Nessun cambio in classifica</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-semibold">Vincitore</p>
                    <p className="text-2xl font-bold text-green-600">
                      {matchResult.winnerId === user?.id ? matchResult.player1Name : matchResult.player2Name}
                    </p>
                  </div>
                )}
              </div>

              {/* Punteggio */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Punteggio</p>
                <p className="text-xl font-bold">{matchResult.score}</p>
              </div>

              {/* Dettaglio calcolo */}
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">{matchResult.player1Name}</p>
                  <p className="text-lg font-bold">{matchResult.player1Total} punti</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">{matchResult.player2Name}</p>
                  <p className="text-lg font-bold">{matchResult.player2Total} punti</p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setConfirmDialogOpen(false)}
                  className="flex-1"
                >
                  Modifica
                </Button>
                <Button
                  onClick={handleConfirmResult}
                  className="flex-1 bg-tennis-court hover:bg-tennis-court/90"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Conferma
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Block Reason Dialog - Appears on top of New Challenge Dialog */}
      <Dialog open={blockReasonOpen} onOpenChange={handleCloseBlockReason}>
        <DialogContent className="w-[95vw] max-w-md z-[100]">
          <DialogHeader>
            <DialogTitle className="text-xl text-red-600 flex items-center gap-2">
              <XCircle className="h-6 w-6" />
              Impossibile Creare Sfida
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {blockReason === 'scheduled' && (
              <div className="space-y-3">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-sm">
                  <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                    Hai già una sfida programmata in sospeso!
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Prima di creare una nuova sfida, devi completare o eliminare quella già programmata.
                  </p>
                </div>

                {scheduledMatches.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">Sfida in sospeso:</p>
                    {scheduledMatches.slice(0, 1).map((match) => {
                      const opponentId = match.winner_id === user?.id ? match.loser_id : match.winner_id;
                      return (
                        <div key={match.id} className="p-3 bg-muted/50 rounded-lg border">
                          <p className="font-medium text-sm">
                            vs {getPlayerName(opponentId)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(match.played_at), 'PPP - HH:mm', { locale: it })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {blockReason === 'toRegister' && (
              <div className="space-y-3">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-sm">
                  <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                    Hai una sfida da registrare in sospeso!
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Prima di creare una nuova sfida, devi registrare il risultato della sfida già giocata.
                  </p>
                </div>

                {matchesToRegister.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">Sfida da registrare:</p>
                    {matchesToRegister.slice(0, 1).map((match) => {
                      const opponentId = match.winner_id === user?.id ? match.loser_id : match.winner_id;
                      return (
                        <div key={match.id} className="p-3 bg-muted/50 rounded-lg border">
                          <p className="font-medium text-sm">
                            vs {getPlayerName(opponentId)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(match.played_at), 'PPP - HH:mm', { locale: it })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {blockReason === 'launchedChallenge' && (
              <div className="space-y-3">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-sm">
                  <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                    Hai già una sfida lanciata in sospeso!
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Prima di lanciare una nuova sfida, devi completare o eliminare quella già lanciata.
                  </p>
                </div>

                {launchedChallenges.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">Sfida in sospeso:</p>
                    {launchedChallenges.slice(0, 1).map((challenge) => {
                      const opponentId = challenge.winner_id === user?.id ? challenge.loser_id : challenge.winner_id;
                      return (
                        <div key={challenge.id} className="p-3 bg-muted/50 rounded-lg border">
                          <p className="font-medium text-sm">
                            vs {getPlayerName(opponentId)}
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {challenge.challenge_status === 'lanciata' ? 'In attesa di accettazione' : 'Accettata - Imposta data/ora'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleCloseBlockReason}
              className="w-full bg-tennis-court hover:bg-tennis-court/90"
            >
              Ho Capito
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Launch Challenge Dialog */}
      <Dialog open={launchChallengeOpen} onOpenChange={setLaunchChallengeOpen}>
        <DialogContent className="w-[95vw] max-w-2xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-2xl text-blue-600">Lancia Sfida</DialogTitle>
            <DialogDescription>
              Seleziona un avversario da sfidare
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-4">
              <Label className="text-lg font-semibold">Seleziona Avversario</Label>
              <Input
                placeholder="Cerca giocatore..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-4"
              />
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {filteredPlayers.map((player) => {
                  const hasPendingMatches = playerHasPendingMatches(player.user_id);
                  const isDisabled = hasPendingMatches;

                  return (
                    <div
                      key={player.id}
                      onClick={() => {
                        if (isDisabled) {
                          toast({
                            title: 'Avversario non disponibile',
                            description: `${player.display_name} ha già una sfida programmata o un match da registrare`,
                            variant: 'destructive',
                          });
                          return;
                        }
                        setSelectedOpponent(player);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isDisabled
                          ? 'opacity-50 cursor-not-allowed bg-gray-100'
                          : selectedOpponent?.id === player.id
                            ? 'bg-blue-600/20 border-2 border-blue-600 cursor-pointer'
                            : 'bg-muted/50 hover:bg-muted cursor-pointer'
                      }`}
                    >
                      <Avatar className="h-12 w-12">
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt={player.display_name} className="object-cover" />
                        ) : (
                          <AvatarFallback>{getPlayerInitials(player.user_id)}</AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{player.display_name}</p>
                        {isDisabled && (
                          <Badge variant="outline" className="mt-1 text-xs border-red-300 text-red-600">
                            Non disponibile
                          </Badge>
                        )}
                      </div>
                      {selectedOpponent?.id === player.id && !isDisabled && (
                        <CheckCircle className="h-5 w-5 text-blue-600 ml-auto" />
                      )}
                      {isDisabled && (
                        <XCircle className="h-5 w-5 text-red-500 ml-auto" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>

          <div className="px-6 py-4 border-t bg-background">
            <Button
              onClick={handleLaunchChallenge}
              disabled={!selectedOpponent}
              className="w-full bg-blue-600 hover:bg-blue-700 h-12"
            >
              <Send className="h-5 w-5 mr-2" />
              Lancia Sfida
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Date/Time Dialog */}
      <Dialog open={setDateTimeOpen} onOpenChange={setSetDateTimeOpen}>
        <DialogContent className="w-[95vw] max-w-2xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2 border-b">
            <DialogTitle className="text-2xl text-tennis-court mb-4">
              {selectedChallengeForDateTime?.is_scheduled ? 'Modifica Data e Ora' : 'Imposta Data e Ora'}
            </DialogTitle>

            {/* Progress Bar */}
            <div className="space-y-4 pb-4">
              {/* Progress Steps */}
              <div className="flex items-center gap-2">
                {/* Step 1 */}
                <div className="flex items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base transition-all ${
                    dateTimeStep > 1
                      ? 'bg-tennis-court text-white'
                      : dateTimeStep === 1
                        ? 'bg-tennis-court text-white ring-4 ring-tennis-court/20'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {dateTimeStep > 1 ? <Check className="h-5 w-5" /> : '1'}
                  </div>
                  <div className={`flex-1 h-1.5 mx-2 rounded-full transition-all ${
                    dateTimeStep > 1 ? 'bg-tennis-court' : 'bg-muted'
                  }`} />
                </div>

                {/* Step 2 */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base transition-all ${
                  dateTimeStep === 2
                    ? 'bg-tennis-court text-white ring-4 ring-tennis-court/20'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  2
                </div>
              </div>

              {/* Step Labels */}
              <div className="flex items-center gap-2">
                {/* Label 1 */}
                <div className="flex-1 flex items-center">
                  <div className="w-10 flex justify-center">
                    <span className={`text-sm font-semibold transition-colors ${
                      dateTimeStep >= 1 ? 'text-tennis-court' : 'text-muted-foreground'
                    }`}>
                      Data
                    </span>
                  </div>
                  <div className="flex-1 mx-2" />
                </div>

                {/* Label 2 */}
                <div className="w-10 flex justify-center">
                  <span className={`text-sm font-semibold transition-colors ${
                    dateTimeStep >= 2 ? 'text-tennis-court' : 'text-muted-foreground'
                  }`}>
                    Orario
                  </span>
                </div>
              </div>
            </div>

            <DialogDescription className="sr-only">
              Scegli quando giocare la sfida
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Step 1: Select Date */}
            {dateTimeStep === 1 && (
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Seleziona Data</Label>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const compareDate = new Date(date);
                      compareDate.setHours(0, 0, 0, 0);
                      return compareDate < today;
                    }}
                    className="rounded-md border"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Select Time */}
            {dateTimeStep === 2 && (
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Seleziona Orario</Label>
                <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
                  {generateTimeSlots().map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedTime(time);
                      }}
                      className={selectedTime === time ? 'bg-tennis-court hover:bg-tennis-court/90' : ''}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fixed Bottom Navigation */}
          <div className="flex justify-between gap-3 px-6 py-4 border-t bg-background">
            {dateTimeStep > 1 && (
              <Button variant="outline" onClick={handleDateTimePrevStep}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Indietro
              </Button>
            )}
            <Button
              onClick={handleDateTimeNextStep}
              className="ml-auto bg-tennis-court hover:bg-tennis-court/90"
            >
              {dateTimeStep === 2 ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {selectedChallengeForDateTime?.is_scheduled ? 'Conferma Modifica' : 'Conferma Data e Ora'}
                </>
              ) : (
                <>
                  Avanti
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Challenges;
