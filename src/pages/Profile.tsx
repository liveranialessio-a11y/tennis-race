import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Trophy, Target, Camera, Edit, Eye, EyeOff, Award, Moon, Sun } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PieChart, Pie, ResponsiveContainer, Cell } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TrophyCard from '@/components/TrophyCard';
import { useTheme } from '@/components/theme-provider';
import { ImageCropper } from '@/components/ImageCropper';

interface PlayerStats {
  id: string;
  user_id: string;
  display_name: string;
  live_rank_position: number;
  live_rank_category: string | null;
  best_live_rank_category_position: number | null;
  best_category: string | null;
  pro_master_points: number;
  pro_master_rank_position: number | null;
  best_pro_master_rank: number | null;
  avatar_url: string | null;
  phone: string | null;
}

interface Championship {
  id: string;
  gold_players_count: number;
  silver_players_count: number;
  bronze_players_count: number;
}

interface FilteredStats {
  wins: number;
  losses: number;
  matches_played: number;
  sets_won: number;
  sets_lost: number;
  win_percentage: number;
  sets_win_percentage: number;
  draws: number;
  games_won: number;
  games_lost: number;
  games_win_percentage: number;
}

interface PlayerTrophy {
  id: string;
  trophy_type: 'pro_master_rank' | 'live_rank' | 'tournament';
  position: number;
  tournament_title: string | null;
  awarded_date: string;
}

const ProfileNew = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  // Player data
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [championship, setChampionship] = useState<Championship | null>(null);
  const [filteredStats, setFilteredStats] = useState<FilteredStats | null>(null);
  const [trophies, setTrophies] = useState<PlayerTrophy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingTrophies, setLoadingTrophies] = useState(false);

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
  const [allTrophiesDialogOpen, setAllTrophiesDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);

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
      fetchTrophies();
    }
  }, [filterType, selectedYear, selectedMonth, playerStats]);

  const fetchPlayerStats = async () => {
    try {
      const { data: championshipData } = await supabase
        .from('championships')
        .select('id, gold_players_count, silver_players_count, bronze_players_count')
        .limit(1)
        .single();

      if (!championshipData) {
        throw new Error('Campionato non trovato');
      }

      setChampionship(championshipData);

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
      // Map filter type to match SQL function expectations
      const sqlFilterType = filterType === 'month' ? 'monthly' : filterType === 'year' ? 'annual' : 'all';

      const { data, error } = await supabase.rpc('get_filtered_player_stats', {
        player_uuid: playerStats.id,
        filter_type: sqlFilterType,
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

  const fetchTrophies = async () => {
    if (!playerStats) return;

    setLoadingTrophies(true);
    try {
      const { data, error } = await supabase
        .from('trophies')
        .select('*')
        .eq('player_id', playerStats.id)
        .order('awarded_date', { ascending: false });

      if (error) throw error;

      setTrophies(data || []);
    } catch (error) {
      console.error('Error fetching trophies:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i trofei",
        variant: "destructive",
      });
    } finally {
      setLoadingTrophies(false);
    }
  };

  // Calculate category-relative position (1-N per category)
  const getCategoryPosition = () => {
    if (!championship || !playerStats || !playerStats.live_rank_position || !playerStats.live_rank_category) {
      return playerStats?.live_rank_position || 0;
    }

    const { live_rank_position, live_rank_category } = playerStats;

    // Fixed category ranges: Gold (1-20), Silver (21-40), Bronze (41-60)
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

  // Get best live rank with category letter
  const getBestLiveRankDisplay = () => {
    if (!playerStats || !playerStats.best_live_rank_category_position || !playerStats.best_category) {
      return {
        position: null,
        category: null,
        isCurrent: false,
      };
    }

    // Map category name to letter
    const categoryLetter = playerStats.best_category === 'gold' ? 'G' :
                          playerStats.best_category === 'silver' ? 'S' : 'B';

    // Check if this is their current position (same category and same position)
    const currentCategoryPosition = getCategoryPosition();
    const isCurrent = playerStats.live_rank_category === playerStats.best_category &&
                     currentCategoryPosition === playerStats.best_live_rank_category_position;

    return {
      position: playerStats.best_live_rank_category_position,
      category: categoryLetter,
      isCurrent,
    };
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
    if (!file) return;

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

    // Create a URL for the selected image and open the cropper
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const handleCropComplete = async (croppedImage: Blob) => {
    if (!user || !playerStats) return;

    setUploadingAvatar(true);
    setCropperOpen(false);

    try {
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedImage, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg',
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
      setImageToCrop(null);
    }
  };

  const handleCropCancel = () => {
    setCropperOpen(false);
    setImageToCrop(null);
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
                className="flex-1 h-12 bg-red-600 hover:bg-red-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Esci
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Impostazioni Tema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon className="h-5 w-5 text-tennis-court" />
            ) : (
              <Sun className="h-5 w-5 text-tennis-court" />
            )}
            Tema Applicazione
          </CardTitle>
          <CardDescription>
            Scegli il tema che preferisci per l'app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              className={`flex-1 h-16 ${theme === 'light' ? 'bg-tennis-court hover:bg-tennis-court/90' : ''}`}
              onClick={() => setTheme('light')}
            >
              <Sun className="h-5 w-5 mr-2" />
              Chiaro
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              className={`flex-1 h-16 ${theme === 'dark' ? 'bg-tennis-court hover:bg-tennis-court/90' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <Moon className="h-5 w-5 mr-2" />
              Scuro
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bacheca Trofei */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-tennis-court" />
            Bacheca Trofei
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTrophies ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-8 w-8 border-4 border-tennis-court border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : trophies.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                Nessun trofeo ancora conquistato. Continua a gareggiare!
              </p>
            </div>
          )}
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
            {/* Posizione Live - con colori dinamici basati su live_rank_category */}
            <div className={`p-4 rounded-xl border-2 ${
              playerStats.live_rank_category === 'gold'
                ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30 border-yellow-600 dark:border-yellow-600'
                : playerStats.live_rank_category === 'silver'
                ? 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/30 border-gray-500 dark:border-gray-500'
                : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-600 dark:border-orange-600'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                playerStats.live_rank_category === 'gold'
                  ? 'text-yellow-900 dark:text-yellow-100'
                  : playerStats.live_rank_category === 'silver'
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-orange-900 dark:text-orange-100'
              }`}>Posizione Live</p>
              <p className={`text-4xl font-black ${
                playerStats.live_rank_category === 'gold'
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : playerStats.live_rank_category === 'silver'
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-orange-600 dark:text-orange-500'
              }`}>{getCategoryPosition()}°</p>
            </div>

            {/* Categoria Attuale */}
            <div className={`p-4 rounded-xl border-2 ${
              playerStats.live_rank_category === 'gold'
                ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30 border-yellow-600 dark:border-yellow-600'
                : playerStats.live_rank_category === 'silver'
                ? 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/30 border-gray-500 dark:border-gray-500'
                : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-600 dark:border-orange-600'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                playerStats.live_rank_category === 'gold'
                  ? 'text-yellow-900 dark:text-yellow-100'
                  : playerStats.live_rank_category === 'silver'
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-orange-900 dark:text-orange-100'
              }`}>Categoria Attuale</p>
              <p className={`text-4xl font-black uppercase ${
                playerStats.live_rank_category === 'gold'
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : playerStats.live_rank_category === 'silver'
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-orange-600 dark:text-orange-500'
              }`}>{playerStats.live_rank_category || '-'}</p>
            </div>

            {/* Miglior Rank Live - con colori dinamici basati su best_category */}
            <div className={`p-4 rounded-xl border-2 ${
              playerStats.best_category === 'gold'
                ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30 border-yellow-600 dark:border-yellow-600'
                : playerStats.best_category === 'silver'
                ? 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/30 border-gray-500 dark:border-gray-500'
                : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-600 dark:border-orange-600'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                playerStats.best_category === 'gold'
                  ? 'text-yellow-900 dark:text-yellow-100'
                  : playerStats.best_category === 'silver'
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-orange-900 dark:text-orange-100'
              }`}>Miglior Rank Live</p>
              <p className={`text-4xl font-black ${
                playerStats.best_category === 'gold'
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : playerStats.best_category === 'silver'
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-orange-600 dark:text-orange-500'
              }`}>
                {(() => {
                  const bestRank = getBestLiveRankDisplay();
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
              playerStats.best_category === 'gold'
                ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30 border-yellow-600 dark:border-yellow-600'
                : playerStats.best_category === 'silver'
                ? 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/30 border-gray-500 dark:border-gray-500'
                : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-600 dark:border-orange-600'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                playerStats.best_category === 'gold'
                  ? 'text-yellow-900 dark:text-yellow-100'
                  : playerStats.best_category === 'silver'
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-orange-900 dark:text-orange-100'
              }`}>Miglior Categoria</p>
              <p className={`text-4xl font-black uppercase ${
                playerStats.best_category === 'gold'
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : playerStats.best_category === 'silver'
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-orange-600 dark:text-orange-500'
              }`}>{playerStats.best_category || 'Bronze'}</p>
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
              <p className="text-4xl font-black text-green-600 dark:text-green-400">
                {(() => {
                  const isBestProMaster = playerStats.pro_master_rank_position === playerStats.best_pro_master_rank;
                  if (isBestProMaster) {
                    return 'MR';
                  } else if (playerStats.best_pro_master_rank) {
                    return `${playerStats.best_pro_master_rank}°`;
                  } else {
                    return '-';
                  }
                })()}
              </p>
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
        <CardContent className="relative">
          {loadingStats && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <div className="h-8 w-8 border-4 border-tennis-court border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {filteredStats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Matches Donut Chart */}
              <Card>
                <CardContent className="pt-6">
                  {(() => {
                    const total = filteredStats.wins + filteredStats.losses + filteredStats.draws;
                    const winPercentage = total > 0 ? Math.round((filteredStats.wins / total) * 100) : 0;
                    const pieData = [
                      { name: 'Vinte', value: filteredStats.wins, color: '#22c55e' },
                      { name: 'Perse', value: filteredStats.losses, color: '#ef4444' },
                      { name: 'Pareggi', value: filteredStats.draws, color: '#9ca3af' },
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
                            <p className="font-bold text-green-600">{filteredStats.wins}</p>
                            <p className="text-xs text-muted-foreground">Vinte</p>
                          </div>
                          <div>
                            <p className="font-bold text-red-600">{filteredStats.losses}</p>
                            <p className="text-xs text-muted-foreground">Perse</p>
                          </div>
                          <div>
                            <p className="font-bold text-gray-500">{filteredStats.draws}</p>
                            <p className="text-xs text-muted-foreground">Pareggi</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Sets Donut Chart */}
              <Card>
                <CardContent className="pt-6">
                  {(() => {
                    const total = filteredStats.sets_won + filteredStats.sets_lost;
                    const winPercentage = total > 0 ? Math.round((filteredStats.sets_won / total) * 100) : 0;
                    const pieData = [
                      { name: 'Vinti', value: filteredStats.sets_won, color: '#22c55e' },
                      { name: 'Persi', value: filteredStats.sets_lost, color: '#ef4444' },
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
                            <p className="font-bold text-green-600">{filteredStats.sets_won}</p>
                            <p className="text-xs text-muted-foreground">Vinti</p>
                          </div>
                          <div>
                            <p className="font-bold text-red-600">{filteredStats.sets_lost}</p>
                            <p className="text-xs text-muted-foreground">Persi</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Games Donut Chart */}
              <Card>
                <CardContent className="pt-6">
                  {(() => {
                    const total = filteredStats.games_won + filteredStats.games_lost;
                    const winPercentage = total > 0 ? Math.round((filteredStats.games_won / total) * 100) : 0;
                    const pieData = [
                      { name: 'Vinti', value: filteredStats.games_won, color: '#22c55e' },
                      { name: 'Persi', value: filteredStats.games_lost, color: '#ef4444' },
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
                            <p className="font-bold text-green-600">{filteredStats.games_won}</p>
                            <p className="text-xs text-muted-foreground">Vinti</p>
                          </div>
                          <div>
                            <p className="font-bold text-red-600">{filteredStats.games_lost}</p>
                            <p className="text-xs text-muted-foreground">Persi</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* All Trophies Dialog */}
      <Dialog open={allTrophiesDialogOpen} onOpenChange={setAllTrophiesDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-tennis-court" />
              Tutti i Trofei
            </DialogTitle>
            <DialogDescription>
              La tua collezione completa di trofei, organizzata per anno
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

      {/* Image Cropper Dialog */}
      {imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          open={cropperOpen}
        />
      )}
    </div>
  );
};

export default ProfileNew;
