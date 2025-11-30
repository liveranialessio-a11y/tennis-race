import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, TrendingUp, Target, Swords, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface PlayerRanking {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  current_position: number;
  current_level: number;
  matches_won: number;
  matches_lost: number;
  matches_played: number;
  master_points: number;
  sets_won: number;
  sets_lost: number;
  avatar_url?: string;
  active_challenge?: {
    opponent_name: string;
    is_challenger: boolean;
    status: string;
  };
}

const Ranking = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  useEffect(() => {
    fetchRanking();
  }, [selectedLevel]);

  const fetchRanking = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('current_position', { ascending: true });

      if (selectedLevel) {
        query = query.eq('current_level', selectedLevel);
      }

      const { data: profilesData, error } = await query;
      if (error) throw error;

      // Get active challenges for each player
      const { data: challengesData } = await supabase
        .from('challenges')
        .select(`
          challenger_id,
          challenged_id,
          status,
          challenger:profiles!challenges_challenger_id_fkey(first_name, last_name),
          challenged:profiles!challenges_challenged_id_fkey(first_name, last_name)
        `)
        .in('status', ['pending', 'accepted']);

      // Map challenges to players
      const playersWithChallenges = profilesData?.map(player => {
        const activeChallenge = challengesData?.find(challenge => 
          challenge.challenger_id === player.user_id || challenge.challenged_id === player.user_id
        );

        let challengeInfo = null;
        if (activeChallenge) {
          const isChallenger = activeChallenge.challenger_id === player.user_id;
          const opponent = isChallenger ? activeChallenge.challenged : activeChallenge.challenger;
          challengeInfo = {
            opponent_name: `${opponent.first_name} ${opponent.last_name}`,
            is_challenger: isChallenger,
            status: activeChallenge.status
          };
        }

        return {
          ...player,
          active_challenge: challengeInfo
        };
      });

      setPlayers(playersWithChallenges || []);
    } catch (error) {
      console.error('Errore nel caricamento della classifica:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPositionIcon = (position: number) => {
    if (position === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (position === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (position === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="h-5 w-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{position}</span>;
  };

  const getLevelBadgeColor = (level: number) => {
    const colors = [
      'bg-green-100 text-green-800',
      'bg-blue-100 text-blue-800', 
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-red-100 text-red-800'
    ];
    return colors[(level - 1) % colors.length] || 'bg-gray-100 text-gray-800';
  };

  const calculateWinRate = (won: number, lost: number) => {
    const total = won + lost;
    if (total === 0) return 0;
    return Math.round((won / total) * 100);
  };

  const getAvailableLevels = () => {
    const levels = [...new Set(players.map(p => p.current_level))].sort((a, b) => a - b);
    return levels;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-tennis-court">
            <Trophy className="h-6 w-6" />
            Classifica Generale
          </CardTitle>
          <CardDescription>
            Posizioni e statistiche di tutti i giocatori del circolo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtri per livello */}
          <div className="mb-6 flex flex-wrap gap-2">
            <Badge
              variant={selectedLevel === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedLevel(null)}
            >
              Tutti i livelli
            </Badge>
            {getAvailableLevels().map((level) => (
              <Badge
                key={level}
                variant={selectedLevel === level ? "default" : "outline"}
                className={`cursor-pointer ${selectedLevel === level ? '' : getLevelBadgeColor(level)}`}
                onClick={() => setSelectedLevel(level)}
              >
                Livello {level}
              </Badge>
            ))}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Pos.</TableHead>
                  <TableHead>Giocatore</TableHead>
                  <TableHead className="text-center">Sfide</TableHead>
                  <TableHead className="text-center">Livello</TableHead>
                  <TableHead className="text-center">Partite</TableHead>
                  <TableHead className="text-center">Vinte</TableHead>
                  <TableHead className="text-center">Perse</TableHead>
                  <TableHead className="text-center">% Vittorie</TableHead>
                  <TableHead className="text-center">Set V/P</TableHead>
                  <TableHead className="text-center">Punti Master</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow key={player.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center justify-center font-semibold text-lg">
                        {player.current_position}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={player.avatar_url} alt={`${player.first_name} ${player.last_name}`} />
                          <AvatarFallback className="text-xs">
                            {player.first_name.charAt(0)}
                            {player.last_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Button 
                            variant="link" 
                            className="p-0 h-auto font-medium text-tennis-court hover:text-tennis-court/80"
                            onClick={() => navigate(`/player-stats/${player.user_id}`)}
                          >
                            {player.first_name} {player.last_name}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {player.active_challenge ? (
                        <div className="flex flex-col items-center gap-1">
                          <Swords className="h-5 w-5 text-orange-500" />
                          <span className="text-xs text-muted-foreground">
                            {player.active_challenge.opponent_name}
                          </span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-tennis-court text-tennis-court hover:bg-tennis-court hover:text-white"
                          onClick={() => navigate(`/challenges?challenge=${player.id}`)}
                        >
                          Lancia Sfida
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getLevelBadgeColor(player.current_level)}>
                        Livello {player.current_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {player.matches_played}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-green-600 hover:text-green-700 font-medium"
                        onClick={() => navigate(`/match-history/${player.user_id}/won`)}
                      >
                        {player.matches_won}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-red-600 hover:text-red-700 font-medium"
                        onClick={() => navigate(`/match-history/${player.user_id}/lost`)}
                      >
                        {player.matches_lost}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">
                          {calculateWinRate(player.matches_won, player.matches_lost)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-green-600 font-medium">{player.sets_won}</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-red-600 font-medium">{player.sets_lost}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Target className="h-3 w-3 text-tennis-court" />
                        <span className="font-bold text-tennis-court">
                          {player.master_points}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {players.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun giocatore trovato per il livello selezionato.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistiche rapide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-tennis-court/10 rounded-lg">
                <Trophy className="h-5 w-5 text-tennis-court" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Giocatori Totali</p>
                <p className="text-2xl font-bold">{players.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-tennis-court/10 rounded-lg">
                <Target className="h-5 w-5 text-tennis-court" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Livelli Attivi</p>
                <p className="text-2xl font-bold">{getAvailableLevels().length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-tennis-court/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-tennis-court" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Partite Totali</p>
                <p className="text-2xl font-bold">
                  {players.reduce((sum, p) => sum + p.matches_played, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Ranking;