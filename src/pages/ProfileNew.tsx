import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Trophy, Target, Camera, Edit, Eye, EyeOff, Award } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PlayerStats {
  id: string;
  user_id: string;
  display_name: string;
  live_rank_position: number;
  best_live_rank: number | null;
  pro_master_points: number;
  pro_master_rank_position: number | null;
  best_pro_master_rank: number | null;
  wins: number;
  losses: number;
  matches_played: number;
  avatar_url: string | null;
  sets_won: number;
  sets_lost: number;
  phone: string | null;
}

interface FilteredStats {
  wins: number;
  losses: number;
  matches_played: number;
  sets_won: number;
  sets_lost: number;
  win_percentage: number;
  sets_win_percentage: number;
}

const ProfileNew = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Player data
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [filteredStats, setFilteredStats] = useState<FilteredStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  // Filter states
  const [filterType, setFilterType] = useState<'month' | 'year' | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  // Edit dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Available years for filter (from 2020 to current year + 1)
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

  useEffect(() => {
    if (user) {
      fetchPlayerStats();
    }
  }, [user]);

  useEffect(() => {
    if (playerStats) {
      fetchFilteredStats();
    }
  }, [filterType, selectedYear, selectedMonth, playerStats]);

  const fetchPlayerStats = async () => {
    try {
      const { data: championshipData } = await supabase
        .from('championships')
        .select('id')
        .limit(1)
        .single();

      if (!championshipData) {
        throw new Error('Campionato non trovato');
      }

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('championship_id', championshipData.id)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setPlayerStats(data);

      const nameParts = data.display_name.split(' ');
      setNewFirstName(nameParts[0] || '');
      setNewLastName(nameParts.slice(1).join(' ') || '');
      setNewPhone(data.phone || '');
    } catch (error) {
      console.error('Error fetching player stats:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le statistiche",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredStats = async () => {
    if (!playerStats) return;

    setLoadingStats(true);
    try {
      const { data, error } = await supabase.rpc('get_filtered_player_stats', {
        player_uuid: playerStats.id,
        filter_type: filterType,
        filter_year: filterType !== 'all' ? selectedYear : null,
        filter_month: filterType === 'month' ? selectedMonth : null,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setFilteredStats(data[0]);
      }
    } catch (error) {
      console.error('Error fetching filtered stats:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le statistiche filtrate",
        variant: "destructive",
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!playerStats) return;

    if (!newFirstName.trim() || !newLastName.trim()) {
      toast({
        title: "Errore",
        description: "Nome e cognome sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 6 caratteri",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non coincidono",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const fullName = `${newFirstName.trim()} ${newLastName.trim()}`;

      const { error: playerError } = await supabase
        .from('players')
        .update({
          display_name: fullName,
          phone: newPhone.trim() || null
        })
        .eq('id', playerStats.id);

      if (playerError) throw playerError;

      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword
        });
        if (passwordError) throw passwordError;
      }

      setPlayerStats({ ...playerStats, display_name: fullName, phone: newPhone.trim() || null });
      setEditDialogOpen(false);

      toast({
        title: "Successo",
        description: "Dati aggiornati con successo",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !playerStats) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Errore",
        description: "Il file è troppo grande. Massimo 5MB.",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Errore",
        description: "Il file deve essere un'immagine.",
        variant: "destructive",
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('players')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', playerStats.id);

      if (updateError) throw updateError;

      setPlayerStats({ ...playerStats, avatar_url: urlData.publicUrl });

      toast({
        title: "Successo",
        description: "Foto profilo aggiornata con successo",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile caricare la foto",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({
        title: "Logout effettuato",
        description: "A presto!",
      });

      navigate('/');
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Data for charts
  const matchesChartData = filteredStats ? [
    {
      name: 'Partite',
      total: filteredStats.matches_played,
      Vinte: filteredStats.wins,
      Perse: filteredStats.losses,
    }
  ] : [];

  const setsChartData = filteredStats ? [
    {
      name: 'Set',
      total: filteredStats.sets_won + filteredStats.sets_lost,
      Vinti: filteredStats.sets_won,
      Persi: filteredStats.sets_lost,
    }
  ] : [];

  if (loading) {
    return (
      <div className="p-6 pb-24 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-96 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!playerStats) {
    return (
      <div className="p-6 pb-24">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">Profilo non trovato</p>
            <Button onClick={handleLogout} variant="outline" className="mt-4">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 space-y-6 bg-gradient-to-br from-tennis-court/5 via-background to-tennis-ball/5 min-h-full">
      <div>
        <h1 className="text-3xl font-bold text-tennis-court">Profilo</h1>
        <p className="text-muted-foreground">Le tue statistiche e informazioni</p>
      </div>

      {/* Account Info */}
      <Card className="overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="h-32 w-32 shadow-[0_0_20px_rgba(139,195,74,0.4)]">
                {playerStats.avatar_url ? (
                  <img
                    src={playerStats.avatar_url}
                    alt={playerStats.display_name}
                    className="object-cover"
                  />
                ) : (
                  <AvatarFallback className="text-5xl bg-tennis-court/10 text-tennis-court">
                    {playerStats.display_name.charAt(0)}
                  </AvatarFallback>
                )}
              </Avatar>
              <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 cursor-pointer">
                <div className="h-10 w-10 rounded-full bg-tennis-court hover:bg-tennis-court/90 flex items-center justify-center shadow-lg transition-colors">
                  {uploadingAvatar ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </div>
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
            </div>

            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground">{playerStats.display_name}</h2>
            </div>

            <div className="flex gap-2 w-full max-w-md">
              <Button
                onClick={() => setEditDialogOpen(true)}
                variant="outline"
                className="flex-1 h-12"
              >
                <Edit className="h-4 w-4 mr-2" />
                Modifica profilo
              </Button>

              <Button
                onClick={handleLogout}
                variant="destructive"
                className="flex-1 h-12"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Esci
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-tennis-court" />
            Classifiche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Posizione Live */}
            <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 rounded-xl border-2 border-yellow-200 dark:border-yellow-800">
              <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-100 uppercase tracking-wider mb-1">Posizione Live</p>
              <p className="text-4xl font-black text-yellow-600 dark:text-yellow-400">{playerStats.live_rank_position}°</p>
            </div>

            {/* Miglior Rank Live */}
            <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 rounded-xl border-2 border-yellow-200 dark:border-yellow-800">
              <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-100 uppercase tracking-wider mb-1">Miglior Rank Live</p>
              <p className="text-4xl font-black text-yellow-600 dark:text-yellow-400">{playerStats.best_live_rank || '-'}°</p>
            </div>

            {/* Posizione Pro Master */}
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl border-2 border-green-200 dark:border-green-800">
              <p className="text-xs font-semibold text-green-900 dark:text-green-100 uppercase tracking-wider mb-1">Posizione Pro Master</p>
              <p className="text-4xl font-black text-green-600 dark:text-green-400">{playerStats.pro_master_rank_position || '-'}°</p>
            </div>

            {/* Punti Pro Master */}
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl border-2 border-green-200 dark:border-green-800">
              <p className="text-xs font-semibold text-green-900 dark:text-green-100 uppercase tracking-wider mb-1">Punti Pro Master</p>
              <p className="text-4xl font-black text-green-600 dark:text-green-400">{Math.round(playerStats.pro_master_points)}</p>
            </div>

            {/* Miglior Rank Pro Master - spanning 2 columns */}
            <div className="col-span-2 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl border-2 border-green-200 dark:border-green-800">
              <p className="text-xs font-semibold text-green-900 dark:text-green-100 uppercase tracking-wider mb-1">Miglior Rank Pro Master</p>
              <p className="text-4xl font-black text-green-600 dark:text-green-400">{playerStats.best_pro_master_rank || '-'}°</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-tennis-court" />
              Statistiche Partite
            </CardTitle>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={filterType} onValueChange={(value) => setFilterType(value as 'month' | 'year' | 'all')}>
                <TabsList>
                  <TabsTrigger value="month">Mensile</TabsTrigger>
                  <TabsTrigger value="year">Annuale</TabsTrigger>
                  <TabsTrigger value="all">Tutto</TabsTrigger>
                </TabsList>
              </Tabs>

              {filterType !== 'all' && (
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
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

              {filterType === 'month' && (
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
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
          </div>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="h-32 flex items-center justify-center">
              <div className="h-8 w-8 border-4 border-tennis-court border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredStats ? (
            <>
              {/* Match Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 uppercase mb-1">Partite</p>
                  <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{filteredStats.matches_played}</p>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border-2 border-green-200 dark:border-green-800">
                  <p className="text-xs font-semibold text-green-900 dark:text-green-100 uppercase mb-1">Vittorie</p>
                  <p className="text-3xl font-black text-green-600 dark:text-green-400">{filteredStats.wins}</p>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border-2 border-red-200 dark:border-red-800">
                  <p className="text-xs font-semibold text-red-900 dark:text-red-100 uppercase mb-1">Sconfitte</p>
                  <p className="text-3xl font-black text-red-600 dark:text-red-400">{filteredStats.losses}</p>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl border-2 border-purple-200 dark:border-purple-800">
                  <p className="text-xs font-semibold text-purple-900 dark:text-purple-100 uppercase mb-1">% Vittorie</p>
                  <p className="text-3xl font-black text-purple-600 dark:text-purple-400">{filteredStats.win_percentage}%</p>
                </div>
              </div>

              {/* Set Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border-2 border-green-200 dark:border-green-800">
                  <p className="text-xs font-semibold text-green-900 dark:text-green-100 uppercase mb-1">Set Vinti</p>
                  <p className="text-3xl font-black text-green-600 dark:text-green-400">{filteredStats.sets_won}</p>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border-2 border-red-200 dark:border-red-800">
                  <p className="text-xs font-semibold text-red-900 dark:text-red-100 uppercase mb-1">Set Persi</p>
                  <p className="text-3xl font-black text-red-600 dark:text-red-400">{filteredStats.sets_lost}</p>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl border-2 border-purple-200 dark:border-purple-800">
                  <p className="text-xs font-semibold text-purple-900 dark:text-purple-100 uppercase mb-1">% Set Vinti</p>
                  <p className="text-3xl font-black text-purple-600 dark:text-purple-400">{filteredStats.sets_win_percentage}%</p>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Charts */}
      {filteredStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Matches Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-tennis-court" />
                Partite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  Vinte: { label: "Vinte", color: "hsl(var(--chart-1))" },
                  Perse: { label: "Perse", color: "hsl(var(--chart-2))" },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={matchesChartData} barGap={8}>
                    <XAxis dataKey="name" />
                    <YAxis hide />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="Vinte" fill="var(--color-Vinte)" radius={[8, 8, 0, 0]}>
                      <LabelList dataKey="Vinte" position="top" />
                    </Bar>
                    <Bar dataKey="Perse" fill="var(--color-Perse)" radius={[8, 8, 0, 0]}>
                      <LabelList dataKey="Perse" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="text-center mt-4">
                <p className="text-2xl font-bold text-muted-foreground">
                  {matchesChartData[0]?.total || 0}
                </p>
                <p className="text-xs text-muted-foreground uppercase">Totale Partite</p>
              </div>
            </CardContent>
          </Card>

          {/* Sets Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-tennis-court" />
                Set
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  Vinti: { label: "Vinti", color: "hsl(var(--chart-1))" },
                  Persi: { label: "Persi", color: "hsl(var(--chart-2))" },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={setsChartData} barGap={8}>
                    <XAxis dataKey="name" />
                    <YAxis hide />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="Vinti" fill="var(--color-Vinti)" radius={[8, 8, 0, 0]}>
                      <LabelList dataKey="Vinti" position="top" />
                    </Bar>
                    <Bar dataKey="Persi" fill="var(--color-Persi)" radius={[8, 8, 0, 0]}>
                      <LabelList dataKey="Persi" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="text-center mt-4">
                <p className="text-2xl font-bold text-muted-foreground">
                  {setsChartData[0]?.total || 0}
                </p>
                <p className="text-xs text-muted-foreground uppercase">Totale Set</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifica Dati Account</DialogTitle>
            <DialogDescription>
              Aggiorna le tue informazioni personali
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">Nome *</Label>
                <Input
                  id="first-name"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="Mario"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Cognome *</Label>
                <Input
                  id="last-name"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="Rossi"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+39 123 456 7890"
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm">{user?.email}</p>
              </div>
              <p className="text-xs text-muted-foreground">L'email non può essere modificata</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Nuova Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Lascia vuoto per non modificare"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {newPassword && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Conferma Password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Conferma la nuova password"
                />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setEditDialogOpen(false)}
              variant="outline"
              className="flex-1"
            >
              Annulla
            </Button>
            <Button
              onClick={handleUpdateProfile}
              disabled={saving || !newFirstName.trim() || !newLastName.trim()}
              className="flex-1 bg-tennis-court hover:bg-tennis-court/90"
            >
              {saving ? 'Salvataggio...' : 'Salva Modifiche'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileNew;
