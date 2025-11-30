import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Trophy, 
  Target, 
  Calendar,
  BarChart3,
  Activity,
  Award
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface UserStats {
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  sets_won: number;
  sets_lost: number;
  current_position: number;
  current_level: number;
  master_points: number;
  first_name: string;
  last_name: string;
}

interface MonthlyStats {
  month: number;
  year: number;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
}

interface MatchResult {
  created_at: string;
  winner_id: string;
  player1_sets: number[];
  player2_sets: number[];
}

const Statistics = () => {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStatistics();
    }
  }, [user]);

  const fetchStatistics = async () => {
    try {
      // Fetch user profile stats
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      setUserStats(profile);

      // Fetch monthly stats
      const { data: monthly, error: monthlyError } = await supabase
        .from('monthly_stats')
        .select('*')
        .eq('user_id', user?.id)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (monthlyError) throw monthlyError;
      setMonthlyStats(monthly || []);

      // Fetch recent match results
      const { data: matches, error: matchesError } = await supabase
        .from('match_results')
        .select('created_at, winner_id, player1_sets, player2_sets')
        .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (matchesError) throw matchesError;
      setRecentMatches(matches || []);

    } catch (error) {
      console.error('Errore nel caricamento delle statistiche:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWinRate = () => {
    if (!userStats || userStats.matches_played === 0) return 0;
    return Math.round((userStats.matches_won / userStats.matches_played) * 100);
  };

  const getPerformanceData = () => {
    return monthlyStats.map(stat => ({
      period: `${stat.month}/${stat.year}`,
      winRate: stat.matches_played > 0 ? Math.round((stat.matches_won / stat.matches_played) * 100) : 0,
      matches: stat.matches_played,
      wins: stat.matches_won,
      losses: stat.matches_lost
    }));
  };

  const getMatchesData = () => {
    return monthlyStats.map(stat => ({
      period: `${stat.month}/${stat.year}`,
      giocate: stat.matches_played,
      vinte: stat.matches_won,
      perse: stat.matches_lost
    }));
  };

  const getSetsData = () => {
    if (!userStats) return [];
    return [
      { name: 'Set Vinti', value: userStats.sets_won, color: '#22c55e' },
      { name: 'Set Persi', value: userStats.sets_lost, color: '#ef4444' }
    ];
  };

  const getStatCard = (title: string, value: string | number, icon: React.ReactNode, trend?: 'up' | 'down', trendValue?: string) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && trendValue && (
              <div className={`flex items-center gap-1 text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{trendValue}</span>
              </div>
            )}
          </div>
          <div className="p-2 bg-tennis-court/10 rounded-lg">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading || !userStats) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
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
            <BarChart3 className="h-6 w-6" />
            Le Mie Statistiche
          </CardTitle>
          <CardDescription>
            Analisi dettagliata delle tue performance - {userStats.first_name} {userStats.last_name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {getStatCard(
              "Posizione Attuale",
              `#${userStats.current_position}`,
              <Trophy className="h-5 w-5 text-tennis-court" />
            )}
            {getStatCard(
              "Livello",
              userStats.current_level,
              <Target className="h-5 w-5 text-tennis-court" />
            )}
            {getStatCard(
              "% Vittorie",
              `${calculateWinRate()}%`,
              <TrendingUp className="h-5 w-5 text-tennis-court" />
            )}
            {getStatCard(
              "Punti Master",
              userStats.master_points,
              <Award className="h-5 w-5 text-tennis-court" />
            )}
          </div>

          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary">Riepilogo</TabsTrigger>
              <TabsTrigger value="sets">Set</TabsTrigger>
              <TabsTrigger value="matches">Partite</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Andamento % Vittorie</CardTitle>
                  <CardDescription>Evoluzione della percentuale di vittorie nel tempo</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={getPerformanceData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => [`${value}%`, '% Vittorie']} />
                      <Area 
                        type="monotone" 
                        dataKey="winRate" 
                        stroke="hsl(var(--tennis-court))" 
                        fill="hsl(var(--tennis-court) / 0.2)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="matches" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Partite per Mese</CardTitle>
                  <CardDescription>Distribuzione delle partite giocate, vinte e perse</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getMatchesData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="vinte" fill="#22c55e" name="Vinte" />
                      <Bar dataKey="perse" fill="#ef4444" name="Perse" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sets" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Distribuzione Set</CardTitle>
                    <CardDescription>Rapporto tra set vinti e persi</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={getSetsData()}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {getSetsData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Statistiche Set</CardTitle>
                    <CardDescription>Dettagli sui set giocati</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Set Totali</span>
                      <span className="font-bold">{userStats.sets_won + userStats.sets_lost}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-green-600">Set Vinti</span>
                      <span className="font-bold text-green-600">{userStats.sets_won}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-red-600">Set Persi</span>
                      <span className="font-bold text-red-600">{userStats.sets_lost}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">% Set Vinti</span>
                      <span className="font-bold">
                        {userStats.sets_won + userStats.sets_lost > 0 
                          ? Math.round((userStats.sets_won / (userStats.sets_won + userStats.sets_lost)) * 100) 
                          : 0}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Statistiche Generali</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Partite Totali</span>
                      <Badge variant="outline">{userStats.matches_played}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-green-600">Partite Vinte</span>
                      <Badge className="bg-green-100 text-green-800">{userStats.matches_won}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-red-600">Partite Perse</span>
                      <Badge className="bg-red-100 text-red-800">{userStats.matches_lost}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Media Punti/Partita</span>
                      <Badge variant="outline">
                        {userStats.matches_played > 0 
                          ? (userStats.master_points / userStats.matches_played).toFixed(1) 
                          : '0.0'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Posizione & Livello</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Posizione Attuale</span>
                      <Badge className="bg-tennis-court/10 text-tennis-court">#{userStats.current_position}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Livello Attuale</span>
                      <Badge variant="outline">Livello {userStats.current_level}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Punti Master</span>
                      <Badge className="bg-tennis-court/10 text-tennis-court">{userStats.master_points}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Efficienza</span>
                      <Badge variant="outline">{calculateWinRate()}% vittorie</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Statistics;