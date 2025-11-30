import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Trophy, 
  Swords, 
  Calendar, 
  TrendingUp, 
  Users,
  Timer,
  Target,
  Award
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface DashboardStats {
  totalChallenges: number;
  pendingChallenges: number;
  winRate: number;
  currentPosition: number;
  currentLevel: number;
  masterPoints: number;
  totalPlayers: number;
}

interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: string;
  created_at: string;
  accepted_date: string | null;
  challenger: { first_name: string; last_name: string; avatar_url?: string; id: string; user_id: string };
  challenged: { first_name: string; last_name: string; avatar_url?: string; id: string; user_id: string };
}

interface MatchResult {
  id: string;
  challenge_id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string;
  player1_sets: number[];
  player2_sets: number[];
  created_at: string;
  player1: { first_name: string; last_name: string; user_id: string };
  player2: { first_name: string; last_name: string; user_id: string };
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentChallenges, setRecentChallenges] = useState<Challenge[]>([]);
  const [upcomingChallenges, setUpcomingChallenges] = useState<Challenge[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchResult[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      setUserProfile(profile);

      // Fetch challenges statistics
      const { data: challenges } = await supabase
        .from('challenges')
        .select('*, challenger:profiles!challenges_challenger_id_fkey(first_name, last_name, avatar_url, id, user_id), challenged:profiles!challenges_challenged_id_fkey(first_name, last_name, avatar_url, id, user_id)')
        .or(`challenger_id.eq.${user?.id},challenged_id.eq.${user?.id}`)
        .order('created_at', { ascending: false })
        .limit(5);

      // Count total players
      const { count: totalPlayers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Calculate stats
      const totalChallenges = challenges?.length || 0;
      const pendingChallenges = challenges?.filter(c => c.status === 'pending').length || 0;
      const wonMatches = profile?.matches_won || 0;
      const totalMatches = profile?.matches_played || 0;
      const winRate = totalMatches > 0 ? Math.round((wonMatches / totalMatches) * 100) : 0;

      setStats({
        totalChallenges,
        pendingChallenges,
        winRate,
        currentPosition: profile?.current_position || 1,
        currentLevel: profile?.current_level || 1,
        masterPoints: profile?.master_points || 0,
        totalPlayers: totalPlayers || 0,
      });

      setRecentChallenges(challenges || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchClubActivity();
    }
  }, [user]);

  const fetchClubActivity = async () => {
    try {
      // Get all challenges that don't have a result yet
      const { data: allResultIds } = await supabase
        .from('match_results')
        .select('challenge_id');
      
      const resultChallengeIds = allResultIds?.map(r => r.challenge_id) || [];

      // Fetch all accepted challenges (club-wide) without results
      const { data: allChallenges } = await supabase
        .from('challenges')
        .select(`
          *,
          challenger:profiles!challenges_challenger_id_fkey(first_name, last_name, avatar_url, id, user_id),
          challenged:profiles!challenges_challenged_id_fkey(first_name, last_name, avatar_url, id, user_id)
        `)
        .eq('status', 'accepted')
        .not('id', 'in', `(${resultChallengeIds.join(',')})`)
        .order('accepted_date', { ascending: false })
        .limit(10);

      setUpcomingChallenges(allChallenges || []);

      // Fetch recent match results (club-wide)
      const { data: allMatches } = await supabase
        .from('match_results')
        .select(`
          *,
          player1:profiles!match_results_player1_id_fkey(first_name, last_name, avatar_url, user_id),
          player2:profiles!match_results_player2_id_fkey(first_name, last_name, avatar_url, user_id)
        `)
        .eq('status', 'validated')
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentMatches(allMatches || []);
    } catch (error) {
      console.error('Error fetching club activity:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-tennis-challenge text-white';
      case 'accepted': return 'bg-tennis-court text-white';
      case 'completed': return 'bg-tennis-winner text-white';
      case 'cancelled': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'In Attesa';
      case 'accepted': return 'Accettata';
      case 'completed': return 'Completata';
      case 'cancelled': return 'Annullata';
      default: return status;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-tennis-court/5 via-background to-tennis-ball/5 min-h-full">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-tennis-court">Dashboard</h1>
        <p className="text-muted-foreground">Panoramica delle tue attività nel circolo</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/ranking">
          <Card className="border-tennis-court/20 hover:shadow-lg transition-shadow cursor-pointer hover:scale-105 transition-transform">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Posizione Attuale</p>
                  <p className="text-2xl font-bold text-tennis-court">#{stats?.currentPosition}</p>
                  <p className="text-xs text-muted-foreground">di {stats?.totalPlayers} giocatori</p>
                </div>
                <Trophy className="h-8 w-8 text-tennis-court" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-tennis-court/20 hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Livello</p>
                <p className="text-2xl font-bold text-tennis-court">{stats?.currentLevel}</p>
                <p className="text-xs text-muted-foreground">{stats?.masterPoints} punti master</p>
              </div>
              <Award className="h-8 w-8 text-tennis-court" />
            </div>
          </CardContent>
        </Card>

        <Link to="/challenges">
          <Card className="border-tennis-court/20 hover:shadow-lg transition-shadow cursor-pointer hover:scale-105 transition-transform">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sfide in Sospeso</p>
                  <p className="text-2xl font-bold text-tennis-challenge">{stats?.pendingChallenges}</p>
                  <p className="text-xs text-muted-foreground">su {stats?.totalChallenges} totali</p>
                </div>
                <Swords className="h-8 w-8 text-tennis-challenge" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/statistics">
          <Card className="border-tennis-court/20 hover:shadow-lg transition-shadow cursor-pointer hover:scale-105 transition-transform">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Percentuale Vittorie</p>
                  <p className="text-2xl font-bold text-tennis-winner">{stats?.winRate}%</p>
                  <Progress value={stats?.winRate} className="mt-2 h-2" />
                </div>
                <Target className="h-8 w-8 text-tennis-winner" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6">
        {/* Club Calendar - Recent Matches and Upcoming Challenges */}
        <Card className="border-tennis-court/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-tennis-court">
              <Calendar className="h-5 w-5" />
              Calendario del Circolo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upcoming Challenges */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Swords className="h-4 w-4 text-tennis-challenge" />
                Sfide in Programma
              </h3>
              {upcomingChallenges.length > 0 ? (
                <div className="space-y-2">
                  {upcomingChallenges.map((challenge) => {
                    const isUserChallenge = challenge.challenger_id === user?.id || challenge.challenged_id === user?.id;
                    return (
                      <div key={challenge.id} className={`flex items-center justify-between p-3 rounded-lg ${isUserChallenge ? 'bg-tennis-court/10 border border-tennis-court/30' : 'bg-muted/50'}`}>
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="h-10 w-10 cursor-pointer" onClick={() => navigate(`/player-stats/${challenge.challenger.user_id}`)}>
                            <AvatarImage src={challenge.challenger.avatar_url} alt={`${challenge.challenger.first_name} ${challenge.challenger.last_name}`} />
                            <AvatarFallback className="text-xs">
                              {challenge.challenger.first_name.charAt(0)}
                              {challenge.challenger.last_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {challenge.challenger.first_name} {challenge.challenger.last_name}
                            </p>
                          </div>
                          <span className="text-muted-foreground font-medium">vs</span>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 cursor-pointer" onClick={() => navigate(`/player-stats/${challenge.challenged.user_id}`)}>
                              <AvatarImage src={challenge.challenged.avatar_url} alt={`${challenge.challenged.first_name} ${challenge.challenged.last_name}`} />
                              <AvatarFallback className="text-xs">
                                {challenge.challenged.first_name.charAt(0)}
                                {challenge.challenged.last_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {challenge.challenged.first_name} {challenge.challenged.last_name}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-muted-foreground min-w-[100px] text-right">
                            {challenge.accepted_date ? new Date(challenge.accepted_date).toLocaleDateString('it-IT') : 'Data da confermare'}
                          </p>
                          {isUserChallenge && (
                            <Button 
                              size="sm"
                              onClick={() => navigate('/match-results')}
                              className="bg-tennis-court hover:bg-tennis-court/90"
                            >
                              Inserisci Risultato
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Swords className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nessuna sfida in programma</p>
                </div>
              )}
            </div>

            {/* Recent Matches */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Trophy className="h-4 w-4 text-tennis-winner" />
                Ultime Partite Giocate
              </h3>
              {recentMatches.length > 0 ? (
                <div className="space-y-2">
                   {recentMatches.map((match) => {
                     const isPlayer1Winner = match.winner_id === match.player1_id;
                     const isPlayer2Winner = match.winner_id === match.player2_id;
                     return (
                       <div key={match.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg flex-wrap md:flex-nowrap">
                         <Avatar 
                           className="h-10 w-10 cursor-pointer"
                           onClick={() => navigate(`/player-stats/${match.player1.user_id}`)}
                         >
                           <AvatarImage src={(match.player1 as any).avatar_url} alt={`${match.player1.first_name} ${match.player1.last_name}`} />
                           <AvatarFallback>
                             {match.player1.first_name.charAt(0)}
                             {match.player1.last_name.charAt(0)}
                           </AvatarFallback>
                         </Avatar>
                         <p className="font-medium text-sm">
                           {match.player1.first_name} {match.player1.last_name}
                         </p>
                         {isPlayer1Winner && <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                         
                         <span className="text-muted-foreground font-medium text-sm">vs</span>
                         
                         <Avatar 
                           className="h-10 w-10 cursor-pointer"
                           onClick={() => navigate(`/player-stats/${match.player2.user_id}`)}
                         >
                           <AvatarImage src={(match.player2 as any).avatar_url} alt={`${match.player2.first_name} ${match.player2.last_name}`} />
                           <AvatarFallback>
                             {match.player2.first_name.charAt(0)}
                             {match.player2.last_name.charAt(0)}
                           </AvatarFallback>
                         </Avatar>
                         <p className="font-medium text-sm">
                           {match.player2.first_name} {match.player2.last_name}
                         </p>
                         {isPlayer2Winner && <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                         
                         <div className="flex items-center gap-2 ml-auto flex-wrap">
                           <div className="flex gap-1 flex-wrap">
                             {match.player1_sets.map((score, i) => (
                               <Badge key={i} variant="outline" className="text-xs">
                                 {score}-{match.player2_sets[i]}
                               </Badge>
                             ))}
                           </div>
                           <p className="text-xs text-muted-foreground whitespace-nowrap">
                             {format(new Date(match.created_at), 'EEE dd/MM/yy', { locale: it })}
                           </p>
                         </div>
                       </div>
                     );
                   })}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nessuna partita giocata</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* User Specific Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-tennis-court/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-tennis-court">
                <Swords className="h-5 w-5" />
                Le Tue Sfide Recenti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentChallenges.length > 0 ? (
                recentChallenges.map((challenge) => {
                  const isWinner = challenge.status === 'completed' && recentMatches.find(m => 
                    m.challenge_id === challenge.id && m.winner_id === user?.id
                  );
                  const matchResult = recentMatches.find(m => m.challenge_id === challenge.id);
                  const opponent = challenge.challenger_id === user?.id ? challenge.challenged : challenge.challenger;
                  const opponentId = challenge.challenger_id === user?.id ? challenge.challenged_id : challenge.challenger_id;
                  
                  return (
                    <div key={challenge.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <Avatar className="h-10 w-10 cursor-pointer" onClick={() => navigate(`/player-stats/${opponentId}`)}>
                          <AvatarImage src={(opponent as any).avatar_url} alt={`${opponent.first_name} ${opponent.last_name}`} />
                          <AvatarFallback className="text-xs">
                            {opponent.first_name.charAt(0)}
                            {opponent.last_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            vs {opponent.first_name} {opponent.last_name}
                          </p>
                          {matchResult && (
                            <p className="text-sm text-muted-foreground">
                              {new Date(matchResult.created_at).toLocaleDateString('it-IT')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {matchResult && (
                          <div className="flex gap-2">
                            {matchResult.player1_id === user?.id ? (
                              matchResult.player1_sets.map((score: number, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {score}-{matchResult.player2_sets[i]}
                                </Badge>
                              ))
                            ) : (
                              matchResult.player2_sets.map((score: number, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {score}-{matchResult.player1_sets[i]}
                                </Badge>
                              ))
                            )}
                          </div>
                        )}
                        {matchResult ? (
                          <Badge className={matchResult.winner_id === user?.id ? 'bg-green-600' : 'bg-red-600'}>
                            {matchResult.winner_id === user?.id ? 'VINTA' : 'PERSA'}
                          </Badge>
                        ) : (
                          <Badge className={getStatusColor(challenge.status)}>
                            {getStatusText(challenge.status)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Swords className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessuna sfida recente</p>
                </div>
              )}
              <Button 
                variant="outline" 
                className="w-full border-tennis-court text-tennis-court hover:bg-tennis-court hover:text-white"
                onClick={() => navigate('/challenges')}
              >
                Vedi Tutte le Sfide
              </Button>
            </CardContent>
          </Card>

          <Card className="border-tennis-court/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-tennis-court">
                <Calendar className="h-5 w-5" />
                Azioni Rapide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full bg-tennis-court hover:bg-tennis-court/90 text-white"
                onClick={() => navigate('/challenges')}
              >
                <Swords className="h-4 w-4 mr-2" />
                Nuova Sfida
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-tennis-court text-tennis-court hover:bg-tennis-court hover:text-white"
                onClick={() => navigate('/ranking')}
              >
                <Trophy className="h-4 w-4 mr-2" />
                Vedi Classifica
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-tennis-court text-tennis-court hover:bg-tennis-court hover:text-white"
                onClick={() => navigate('/stats')}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Le Mie Statistiche
              </Button>
              <Button 
                variant="outline" 
                className="w-full border-tennis-court text-tennis-court hover:bg-tennis-court hover:text-white"
                onClick={() => navigate('/profile')}
              >
                <Users className="h-4 w-4 mr-2" />
                Modifica Profilo
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;