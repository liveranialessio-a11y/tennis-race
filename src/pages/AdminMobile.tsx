import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Edit, Calculator, Award, UserPlus, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import AssignTournamentTrophyDialog from "@/components/AssignTournamentTrophyDialog";

interface Player {
  id: string;
  user_id: string;
  championship_id: string;
  display_name: string;
  wins: number;
  losses: number;
  matches_played: number;
  pro_master_points: number;
  live_rank_position: number;
  live_rank_category: string;
}

interface RegistrationRequest {
  id: string;
  user_id: string;
  championship_id: string;
  display_name: string;
  phone: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
}

interface Championship {
  id: string;
  name: string;
  admin_id: string;
  gold_players_count: number;
  silver_players_count: number;
  bronze_players_count: number;
}

interface Match {
  id: string;
  championship_id: string;
  winner_id: string;
  loser_id: string;
  score: string;
  played_at: string;
  is_validated: boolean;
}

export default function AdminMobile() {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Feature 1: Add Match
  const [newMatchChampionship, setNewMatchChampionship] = useState("");
  const [newMatchWinner, setNewMatchWinner] = useState("");
  const [newMatchLoser, setNewMatchLoser] = useState("");
  const [newMatchScore, setNewMatchScore] = useState("");
  const [newMatchDate, setNewMatchDate] = useState("");

  // Feature 3: Modify Match
  const [modifyMatchId, setModifyMatchId] = useState("");
  const [modifyMatchScore, setModifyMatchScore] = useState("");

  // Feature 7: Monthly Calculation
  const [monthlyCalcChampionship, setMonthlyCalcChampionship] = useState("");
  const [minMatchesRequired, setMinMatchesRequired] = useState<number>(2);

  // Pro Master Points Parameters
  const [minMatchesForPoints, setMinMatchesForPoints] = useState<number>(1);
  const [firstPlacePoints, setFirstPlacePoints] = useState<number>(500);

  // Feature 8: Trophy Management
  const [trophyChampionship, setTrophyChampionship] = useState("");
  const [showTournamentDialog, setShowTournamentDialog] = useState(false);

  // Feature 9: Match Statistics
  const [statsYear, setStatsYear] = useState<string>(() => new Date().getFullYear().toString());
  const [statsMonth, setStatsMonth] = useState<string>("all");
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [matchStats, setMatchStats] = useState<{
    total: number;
    yearTotal: number;
    monthTotal: number;
  }>({ total: 0, yearTotal: 0, monthTotal: 0 });

  // Feature 10: Email Errors
  const [emailErrors, setEmailErrors] = useState<any[]>([]);

  // Load data on mount
  useEffect(() => {
    loadPlayers();
    loadChampionships();
    loadMatches();
    loadRegistrationRequests();
    loadAvailableYears();
    loadEmailErrors();
  }, []);

  // Update match stats when filters change
  useEffect(() => {
    if (availableYears.length > 0) {
      calculateMatchStats();
    }
  }, [statsYear, statsMonth, matches]);

  // Load championship parameters when championship changes
  useEffect(() => {
    const loadChampionshipParams = async () => {
      if (!monthlyCalcChampionship) {
        // Reset to defaults
        setMinMatchesRequired(2);
        setMinMatchesForPoints(1);
        setFirstPlacePoints(500);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("championships")
          .select("min_matches_required, min_matches_for_points, first_place_points")
          .eq("id", monthlyCalcChampionship)
          .single();

        if (error) throw error;

        if (data) {
          if (data.min_matches_required !== null) setMinMatchesRequired(data.min_matches_required);
          if (data.min_matches_for_points !== null) setMinMatchesForPoints(data.min_matches_for_points);
          if (data.first_place_points !== null) setFirstPlacePoints(data.first_place_points);
        }
      } catch (error) {
        console.error("Error loading championship parameters:", error);
        // Fallback to defaults
        setMinMatchesRequired(2);
        setMinMatchesForPoints(1);
        setFirstPlacePoints(500);
      }
    };

    loadChampionshipParams();
  }, [monthlyCalcChampionship]);

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("live_rank_position", { ascending: true });

      if (error) throw error;
      setPlayers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadChampionships = async () => {
    try {
      const { data, error } = await supabase
        .from("championships")
        .select("id, name, admin_id, gold_players_count, silver_players_count, bronze_players_count")
        .order("name");

      if (error) throw error;
      setChampionships(data || []);
    } catch (error: any) {
      console.error("Error loading championships:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadMatches = async () => {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .order("played_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setMatches(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadRegistrationRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("registration_requests" as any)
        .select("*")
        .eq("status", "pending")
        .order("requested_at", { ascending: true });

      if (error) throw error;
      setRegistrationRequests((data || []) as unknown as RegistrationRequest[]);
    } catch (error: any) {
      console.error("Error loading registration requests:", error);
      // Don't show error toast if table doesn't exist yet (migration not run)
      if (!error.message?.includes("does not exist")) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  // Feature 9: Match Statistics - Load available years
  const loadAvailableYears = async () => {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("played_at")
        .eq("is_scheduled", false);

      if (error) throw error;

      if (data && data.length > 0) {
        const years = new Set<string>();
        data.forEach((match) => {
          const year = new Date(match.played_at).getFullYear().toString();
          years.add(year);
        });
        const sortedYears = Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
        setAvailableYears(sortedYears);
      }
    } catch (error: any) {
      console.error("Error loading available years:", error);
    }
  };

  // Feature 10: Email Errors - Load email errors
  const loadEmailErrors = async () => {
    try {
      const { data, error } = await supabase
        .from("email_errors")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setEmailErrors(data || []);
    } catch (error: any) {
      console.error("Error loading email errors:", error);
      // Don't show error toast if table doesn't exist yet
      if (!error.message?.includes("does not exist")) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  // Feature 9: Match Statistics - Calculate stats
  const calculateMatchStats = async () => {
    try {
      // Get all completed matches (not scheduled)
      const { data: allMatches, error: allError } = await supabase
        .from("matches")
        .select("played_at")
        .eq("is_scheduled", false);

      if (allError) throw allError;

      const total = allMatches?.length || 0;

      // Get matches for selected year
      const { data: yearMatches, error: yearError } = await supabase
        .from("matches")
        .select("played_at")
        .eq("is_scheduled", false)
        .gte("played_at", `${statsYear}-01-01T00:00:00`)
        .lte("played_at", `${statsYear}-12-31T23:59:59`);

      if (yearError) throw yearError;

      const yearTotal = yearMatches?.length || 0;

      // Get matches for selected month (if not "all")
      let monthTotal = 0;
      if (statsMonth !== "all") {
        const monthNum = statsMonth.padStart(2, '0');
        // Calculate the last day of the month correctly
        const lastDay = new Date(parseInt(statsYear), parseInt(statsMonth), 0).getDate();
        const { data: monthMatches, error: monthError } = await supabase
          .from("matches")
          .select("played_at")
          .eq("is_scheduled", false)
          .gte("played_at", `${statsYear}-${monthNum}-01T00:00:00`)
          .lte("played_at", `${statsYear}-${monthNum}-${lastDay}T23:59:59`);

        if (monthError) throw monthError;
        monthTotal = monthMatches?.length || 0;
      }

      setMatchStats({ total, yearTotal, monthTotal });
    } catch (error: any) {
      console.error("Error calculating match stats:", error);
      toast({
        title: "Errore",
        description: "Impossibile calcolare le statistiche",
        variant: "destructive",
      });
    }
  };

  // Feature 1: Add Match
  const handleAddMatch = async () => {
    if (!newMatchChampionship || !newMatchWinner || !newMatchLoser || !newMatchScore) {
      toast({
        title: "Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_create_match", {
        p_championship_id: newMatchChampionship,
        p_winner_id: newMatchWinner,
        p_loser_id: newMatchLoser,
        p_score: newMatchScore,
        p_played_at: newMatchDate || new Date().toISOString(),
        p_is_scheduled: false,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        // Reset form
        setNewMatchChampionship("");
        setNewMatchWinner("");
        setNewMatchLoser("");
        setNewMatchScore("");
        setNewMatchDate("");
        // Reload data
        loadMatches();
        loadPlayers();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Feature 3: Modify Match
  const handleModifyMatch = async () => {
    if (!modifyMatchId || !modifyMatchScore) {
      toast({
        title: "Error",
        description: "Please provide match ID and new score",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_update_match_score", {
        match_id_param: modifyMatchId,
        new_score: modifyMatchScore,
        new_winner_id: null,
        new_loser_id: null,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        setModifyMatchId("");
        setModifyMatchScore("");
        loadMatches();
        loadPlayers();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Feature 7a: Calculate Inactivity Demotion
  const handleInactivityDemotion = async () => {
    if (!monthlyCalcChampionship) {
      toast({
        title: "Error",
        description: "Please select a championship",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("calculate_inactivity_demotion", {
        target_championship_id: monthlyCalcChampionship,
        target_month: new Date().toISOString().slice(0, 10), // Current date
        min_matches_required: minMatchesRequired,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        message: string;
        demoted_players: number;
        period: { from: string; to: string };
        all_players: any[];
        demoted_details: any[];
      };


      if (result.success) {
        toast({
          title: "Success",
          description: `${result.message}. Demoted ${result.demoted_players} inactive players.`,
        });
        loadPlayers();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Feature 7a-bis: Save Minimum Matches Required
  const handleSaveMinMatches = async () => {
    if (!monthlyCalcChampionship) {
      toast({
        title: "Error",
        description: "Please select a championship",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("championships")
        .update({ min_matches_required: minMatchesRequired })
        .eq("id", monthlyCalcChampionship);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Minimum matches requirement saved: ${minMatchesRequired}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Feature 7a-ter: Save Pro Master Points Parameters
  const handleSaveProMasterParams = async () => {
    if (!monthlyCalcChampionship) {
      toast({
        title: "Error",
        description: "Please select a championship",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("championships")
        .update({
          min_matches_for_points: minMatchesForPoints,
          first_place_points: firstPlacePoints,
        })
        .eq("id", monthlyCalcChampionship);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pro Master Points parameters saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Feature 7a-quater: Reset Monthly Matches Counter
  const handleResetMonthlyMatches = async () => {
    if (!monthlyCalcChampionship) {
      toast({
        title: "Error",
        description: "Please select a championship",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("reset_monthly_matches", {
        target_championship_id: monthlyCalcChampionship,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        message: string;
        players_updated: number;
      };

      if (result.success) {
        toast({
          title: "Success",
          description: `${result.message}. Reset counter for ${result.players_updated} players.`,
        });
        loadPlayers();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Feature 7b: Calculate Pro Master Points
  const handleProMasterPoints = async () => {
    if (!monthlyCalcChampionship) {
      toast({
        title: "Error",
        description: "Please select a championship",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("calculate_pro_master_points", {
        target_championship_id: monthlyCalcChampionship,
        target_month: new Date().toISOString().slice(0, 10), // Current date
        min_matches_for_points: minMatchesForPoints,
        first_place_points: firstPlacePoints,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        message: string;
        players_awarded: number;
        period: { from: string; to: string };
        all_players: any[];
        awarded_details: any[];
      };


      if (result.success) {
        toast({
          title: "Success",
          description: `${result.message}. Awarded ${result.players_awarded} players.`,
        });
        loadPlayers();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Feature 7e: Process Category Swaps
  const handleCategorySwaps = async () => {
    if (!monthlyCalcChampionship) {
      toast({
        title: "Error",
        description: "Please select a championship",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("process_category_swaps", {
        target_championship_id: monthlyCalcChampionship,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        message: string;
        swaps_performed: number;
        details: any;
      };

      if (result.success) {
        toast({
          title: "Success",
          description: `${result.message}. Performed ${result.swaps_performed} swaps.`,
        });
        loadPlayers();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Feature 8a: Assign Pro Master Rank Trophies
  const handleAssignProRank = async () => {
    if (!trophyChampionship) {
      toast({
        title: "Errore",
        description: "Seleziona un campionato",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get top 3 players by pro_master_rank_position
      const { data: topPlayers, error: fetchError } = await supabase
        .from('players')
        .select('id, display_name, pro_master_rank_position')
        .eq('championship_id', trophyChampionship)
        .not('pro_master_rank_position', 'is', null)
        .order('pro_master_rank_position', { ascending: true })
        .limit(3);

      if (fetchError) throw fetchError;

      if (!topPlayers || topPlayers.length === 0) {
        toast({
          title: "Info",
          description: "Nessun giocatore trovato con ranking Pro Master",
        });
        return;
      }

      // Assign trophies to top 3
      const trophies = topPlayers.map((player, index) => ({
        player_id: player.id,
        championship_id: trophyChampionship,
        trophy_type: 'pro_master_rank',
        position: index + 1,
        tournament_title: null,
        awarded_date: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('trophies')
        .insert(trophies);

      if (insertError) throw insertError;

      toast({
        title: "Successo",
        description: `Assegnati ${topPlayers.length} trofei Pro Master ai primi ${topPlayers.length} giocatori`,
      });
    } catch (error: any) {
      console.error('Error assigning pro rank trophies:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile assegnare i trofei",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Feature 8b: Assign Live Rank Trophies (Top 3 per category)
  const handleAssignLiveRank = async () => {
    if (!trophyChampionship) {
      toast({
        title: "Errore",
        description: "Seleziona un campionato",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const categories = ['gold', 'silver', 'bronze'];
      const allTrophies: any[] = [];

      // For each category, get top 3 players
      for (const category of categories) {
        const { data: topPlayers, error: fetchError } = await supabase
          .from('players')
          .select('id, display_name, live_rank_position, live_rank_category')
          .eq('championship_id', trophyChampionship)
          .eq('live_rank_category', category)
          .order('live_rank_position', { ascending: true })
          .limit(3);

        if (fetchError) throw fetchError;

        if (topPlayers && topPlayers.length > 0) {
          // Create trophies for top 3 of this category
          const categoryTrophies = topPlayers.map((player, index) => ({
            player_id: player.id,
            championship_id: trophyChampionship,
            trophy_type: 'live_rank',
            position: index + 1,
            tournament_title: `${index + 1}° categoria ${category}`,
            awarded_date: new Date().toISOString(),
          }));

          allTrophies.push(...categoryTrophies);
        }
      }

      if (allTrophies.length === 0) {
        toast({
          title: "Info",
          description: "Nessun giocatore trovato nelle categorie",
        });
        return;
      }

      // Insert all trophies
      const { error: insertError } = await supabase
        .from('trophies')
        .insert(allTrophies);

      if (insertError) throw insertError;

      toast({
        title: "Successo",
        description: `Assegnati ${allTrophies.length} trofei Posizione Classifica Live (top 3 per ogni categoria)`,
      });
    } catch (error: any) {
      console.error('Error assigning live rank trophies:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile assegnare i trofei",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Feature 8c: Open Tournament Trophy Dialog
  const handleOpenTournamentDialog = () => {
    if (!trophyChampionship) {
      toast({
        title: "Errore",
        description: "Seleziona un campionato prima",
        variant: "destructive",
      });
      return;
    }
    setShowTournamentDialog(true);
  };

  // Feature 9: Registration Requests - Approve
  const handleApproveRequest = async (requestId: string, category: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("approve_registration_request" as any, {
        request_id: requestId,
        target_category: category,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; message: string };

      if (result.success) {
        toast({
          title: "Successo",
          description: result.message,
        });
        loadRegistrationRequests();
        loadPlayers();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Feature 9: Registration Requests - Reject
  const handleRejectRequest = async (requestId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("reject_registration_request" as any, {
        request_id: requestId,
        rejection_reason: null,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; message: string };

      if (result.success) {
        toast({
          title: "Successo",
          description: result.message,
        });
        loadRegistrationRequests();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPlayerName = (userId: string) => {
    const player = players.find(p => p.user_id === userId);
    return player ? player.display_name : "Unknown";
  };

  // Helper function to sort players by category and position
  const getSortedPlayers = (championshipId: string) => {
    const categoryOrder = { gold: 1, silver: 2, bronze: 3 };

    return players
      .filter(p => p.championship_id === championshipId)
      .sort((a, b) => {
        // First sort by category
        const categoryA = categoryOrder[a.live_rank_category as keyof typeof categoryOrder] || 999;
        const categoryB = categoryOrder[b.live_rank_category as keyof typeof categoryOrder] || 999;

        if (categoryA !== categoryB) {
          return categoryA - categoryB;
        }

        // Then sort by position within category
        return a.live_rank_position - b.live_rank_position;
      });
  };

  // Helper function to sort all players (without filtering by championship)
  const getAllSortedPlayers = () => {
    const categoryOrder = { gold: 1, silver: 2, bronze: 3 };

    return [...players].sort((a, b) => {
      // First sort by category
      const categoryA = categoryOrder[a.live_rank_category as keyof typeof categoryOrder] || 999;
      const categoryB = categoryOrder[b.live_rank_category as keyof typeof categoryOrder] || 999;

      if (categoryA !== categoryB) {
        return categoryA - categoryB;
      }

      // Then sort by position within category
      return a.live_rank_position - b.live_rank_position;
    });
  };

  // Helper function to get category-relative position
  const getCategoryPositionForPlayer = (player: Player) => {
    if (!player.live_rank_position || !player.live_rank_category) {
      return player.live_rank_position;
    }

    const { live_rank_position, live_rank_category } = player;

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

  // Helper function to format player display in dropdown
  const formatPlayerDisplay = (player: Player) => {
    const categoryEmoji = {
      gold: '🥇',
      silver: '🥈',
      bronze: '🥉'
    };
    const emoji = categoryEmoji[player.live_rank_category as keyof typeof categoryEmoji] || '';
    const categoryPosition = getCategoryPositionForPlayer(player);
    return `${emoji} ${player.live_rank_category.toUpperCase()} #${categoryPosition} - ${player.display_name}`;
  };

  // Helper function to get formatted player name with rank
  const getFormattedPlayerName = (userId: string) => {
    const player = players.find(p => p.user_id === userId);
    if (!player) return "Unknown";

    const categoryEmoji = {
      gold: '🥇',
      silver: '🥈',
      bronze: '🥉'
    };
    const emoji = categoryEmoji[player.live_rank_category as keyof typeof categoryEmoji] || '';
    const categoryPosition = getCategoryPositionForPlayer(player);
    return `${emoji} ${player.live_rank_category.toUpperCase()} #${categoryPosition} - ${player.display_name}`;
  };

  // Helper function for Modify Match - shows only category and name
  const getFormattedPlayerNameForModify = (userId: string) => {
    const player = players.find(p => p.user_id === userId);
    if (!player) return "Unknown";

    return `${player.live_rank_category.toUpperCase()} - ${player.display_name}`;
  };

  // Helper function to group matches by date (last 7 days only)
  const getMatchesGroupedByDate = () => {
    const grouped: { [date: string]: Match[] } = {};
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    matches
      .filter((match) => {
        const matchDate = new Date(match.played_at);
        return matchDate >= sevenDaysAgo;
      })
      .forEach((match) => {
        const date = new Date(match.played_at).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });

        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(match);
      });

    return grouped;
  };

  return (
    <div className="container mx-auto p-3 pb-20 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>

      <Accordion type="single" collapsible className="w-full space-y-2">
        {/* Feature 0: Registration Requests */}
        <AccordionItem value="registration-requests" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="font-semibold">Richieste di Registrazione</span>
              {registrationRequests.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {registrationRequests.length}
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle>Richieste di Registrazione</CardTitle>
                <CardDescription>Approva o rifiuta le richieste di nuovi utenti</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {registrationRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nessuna richiesta in attesa
                  </div>
                ) : (
                  <div className="space-y-3">
                    {registrationRequests.map((request) => (
                      <div key={request.id} className="border rounded-lg p-4 space-y-3">
                        <div>
                          <div className="font-semibold text-lg">{request.display_name}</div>
                          {request.phone && (
                            <div className="text-sm text-gray-600">Tel: {request.phone}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            Richiesta il: {new Date(request.requested_at).toLocaleDateString('it-IT', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Seleziona Categoria</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              onClick={() => handleApproveRequest(request.id, 'gold')}
                              disabled={loading}
                              variant="outline"
                              className="bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-300 dark:border-yellow-600"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Gold
                            </Button>
                            <Button
                              onClick={() => handleApproveRequest(request.id, 'silver')}
                              disabled={loading}
                              variant="outline"
                              className="bg-gray-500/20 hover:bg-gray-500/30 border-gray-300 dark:border-gray-500"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Silver
                            </Button>
                            <Button
                              onClick={() => handleApproveRequest(request.id, 'bronze')}
                              disabled={loading}
                              variant="outline"
                              className="bg-orange-500/20 hover:bg-orange-500/30 border-orange-300 dark:border-orange-600"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Bronze
                            </Button>
                          </div>
                          <Button
                            onClick={() => handleRejectRequest(request.id)}
                            disabled={loading}
                            variant="destructive"
                            className="w-full"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rifiuta Richiesta
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Feature 1: Add Match */}
        <AccordionItem value="add-match" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="font-semibold">Add Match</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
          <Card>
            <CardHeader>
              <CardTitle>Add Match</CardTitle>
              <CardDescription>Create a new match between any players at any date/time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="new-match-championship">Championship</Label>
                <Select value={newMatchChampionship} onValueChange={setNewMatchChampionship}>
                  <SelectTrigger id="new-match-championship">
                    <SelectValue placeholder="Select championship" />
                  </SelectTrigger>
                  <SelectContent>
                    {championships.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="new-match-winner">Winner</Label>
                <Select value={newMatchWinner} onValueChange={setNewMatchWinner}>
                  <SelectTrigger id="new-match-winner">
                    <SelectValue placeholder="Select winner" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSortedPlayers(newMatchChampionship).map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {formatPlayerDisplay(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="new-match-loser">Loser</Label>
                <Select value={newMatchLoser} onValueChange={setNewMatchLoser}>
                  <SelectTrigger id="new-match-loser">
                    <SelectValue placeholder="Select loser" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSortedPlayers(newMatchChampionship).map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {formatPlayerDisplay(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="new-match-score">Score (e.g., "6-4 6-3")</Label>
                <Input
                  id="new-match-score"
                  value={newMatchScore}
                  onChange={(e) => setNewMatchScore(e.target.value)}
                  placeholder="6-4 6-3"
                />
              </div>

              <div>
                <Label htmlFor="new-match-date">Match Date (optional, defaults to now)</Label>
                <Input
                  id="new-match-date"
                  type="datetime-local"
                  value={newMatchDate}
                  onChange={(e) => setNewMatchDate(e.target.value)}
                />
              </div>

              <Button onClick={handleAddMatch} disabled={loading}>
                {loading ? "Creating..." : "Create Match"}
              </Button>
            </CardContent>
          </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Feature 3: Modify Match */}
        <AccordionItem value="modify-match" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              <span className="font-semibold">Modify Match</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
          <Card>
            <CardHeader>
              <CardTitle>Modify Match</CardTitle>
              <CardDescription>Update match score</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="modify-match-id">Select Match</Label>
                <Select value={modifyMatchId} onValueChange={setModifyMatchId}>
                  <SelectTrigger id="modify-match-id">
                    <SelectValue placeholder="Select match to modify" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(getMatchesGroupedByDate()).map(([date, dateMatches]) => (
                      <SelectGroup key={date}>
                        <SelectLabel>{date}</SelectLabel>
                        {dateMatches.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {getFormattedPlayerNameForModify(m.winner_id)} vs {getFormattedPlayerNameForModify(m.loser_id)} - {m.score}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="modify-match-score">New Score</Label>
                <Input
                  id="modify-match-score"
                  value={modifyMatchScore}
                  onChange={(e) => setModifyMatchScore(e.target.value)}
                  placeholder="6-4 6-3"
                />
              </div>

              <Button onClick={handleModifyMatch} disabled={loading}>
                {loading ? "Updating..." : "Update Match"}
              </Button>
            </CardContent>
          </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Feature 7: Monthly Calculation */}
        <AccordionItem value="monthly-calc" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              <span className="font-semibold">Monthly Calculation</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
          <Card>
            <CardHeader>
              <CardTitle>Monthly Calculation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="monthly-calc-championship">Championship</Label>
                <Select value={monthlyCalcChampionship} onValueChange={setMonthlyCalcChampionship}>
                  <SelectTrigger id="monthly-calc-championship">
                    <SelectValue placeholder="Select championship" />
                  </SelectTrigger>
                  <SelectContent>
                    {championships.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="min-matches">Minimum Matches Required for Activity</Label>
                <div className="flex gap-2">
                  <Input
                    id="min-matches"
                    type="number"
                    min="0"
                    max="10"
                    value={minMatchesRequired}
                    onChange={(e) => setMinMatchesRequired(parseInt(e.target.value) || 0)}
                    className="flex-1"
                  />
                  <Button onClick={handleSaveMinMatches} variant="outline" className="whitespace-nowrap">
                    Save
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 dark:border-blue-500/40 rounded-lg space-y-3">
                <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Pro Master Points Parameters</h4>

                <div>
                  <Label htmlFor="min-matches-points">Minimum Matches for Points</Label>
                  <Input
                    id="min-matches-points"
                    type="number"
                    min="0"
                    max="10"
                    value={minMatchesForPoints}
                    onChange={(e) => setMinMatchesForPoints(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <Label htmlFor="first-place-points">First Place Points</Label>
                  <Input
                    id="first-place-points"
                    type="number"
                    min="0"
                    step="10"
                    value={firstPlacePoints}
                    onChange={(e) => setFirstPlacePoints(parseInt(e.target.value) || 0)}
                  />
                </div>

                <Button onClick={handleSaveProMasterParams} variant="outline" size="sm" className="w-full">
                  Save Pro Master Parameters
                </Button>
              </div>

              <div className="p-4 bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 dark:border-red-500/40 rounded-lg">
                <Button
                  onClick={handleResetMonthlyMatches}
                  disabled={loading}
                  variant="outline"
                  className="w-full border-red-500/30 dark:border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-500/20 dark:hover:bg-red-500/30"
                >
                  {loading ? "Resetting..." : "🔄 Reset Monthly Matches Counter"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleInactivityDemotion} disabled={loading} variant="destructive">
                  {loading ? "Processing..." : "1. Inactivity Demotion"}
                </Button>

                <Button onClick={handleProMasterPoints} disabled={loading} variant="default">
                  {loading ? "Processing..." : "2. Pro Master Points"}
                </Button>

                <Button onClick={handleCategorySwaps} disabled={loading} variant="default" className="col-span-2">
                  {loading ? "Processing..." : "3. Process Category Swaps"}
                </Button>
              </div>
            </CardContent>
          </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Feature 8: Trophy Management */}
        <AccordionItem value="trophy-management" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span className="font-semibold">Gestione Trofei</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Gestione Trofei
              </CardTitle>
              <CardDescription>Assegna trofei ai giocatori per i loro risultati</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="trophy-championship">Campionato</Label>
                <Select value={trophyChampionship} onValueChange={setTrophyChampionship}>
                  <SelectTrigger id="trophy-championship">
                    <SelectValue placeholder="Seleziona campionato" />
                  </SelectTrigger>
                  <SelectContent>
                    {championships.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 dark:border-blue-500/40 rounded-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Tipi di Trofeo:</h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>1. Pro Master Rank: Assegna automaticamente ai primi 3 della classifica Pro Master</li>
                  <li>2. Posizione Classifica Live: Assegna ai primi 3 di ogni categoria (Gold, Silver, Bronze)</li>
                  <li>3. Trofeo Torneo: Assegna manualmente per tornei specifici (es. Roland Garros)</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Button
                  onClick={handleAssignProRank}
                  disabled={loading || !trophyChampionship}
                  className="w-full"
                >
                  {loading ? "Assegnando..." : "Assegna Pro Rank (Top 3)"}
                </Button>

                <Button
                  onClick={handleAssignLiveRank}
                  disabled={loading || !trophyChampionship}
                  variant="default"
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {loading ? "Assegnando..." : "Assegna Posizione Classifica Live"}
                </Button>

                <Button
                  onClick={handleOpenTournamentDialog}
                  disabled={loading || !trophyChampionship}
                  variant="secondary"
                  className="w-full"
                >
                  Assegna Trofeo Torneo
                </Button>
              </div>
            </CardContent>
          </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Feature 9: Match Statistics */}
        <AccordionItem value="match-stats" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="font-semibold">Statistiche Partite</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Statistiche Partite
                </CardTitle>
                <CardDescription>Visualizza il numero di partite giocate per anno e mese</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Filters */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stats-year">Anno</Label>
                    <Select value={statsYear} onValueChange={(value) => {
                      setStatsYear(value);
                      setStatsMonth("all"); // Reset month when year changes
                    }}>
                      <SelectTrigger id="stats-year">
                        <SelectValue placeholder="Seleziona anno" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map((year) => (
                          <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="stats-month">Mese</Label>
                    <Select
                      value={statsMonth}
                      onValueChange={setStatsMonth}
                      disabled={!statsYear}
                    >
                      <SelectTrigger id="stats-month">
                        <SelectValue placeholder="Tutti" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] overflow-y-auto">
                        <SelectItem value="all">Tutti</SelectItem>
                        <SelectItem value="1">Gennaio</SelectItem>
                        <SelectItem value="2">Febbraio</SelectItem>
                        <SelectItem value="3">Marzo</SelectItem>
                        <SelectItem value="4">Aprile</SelectItem>
                        <SelectItem value="5">Maggio</SelectItem>
                        <SelectItem value="6">Giugno</SelectItem>
                        <SelectItem value="7">Luglio</SelectItem>
                        <SelectItem value="8">Agosto</SelectItem>
                        <SelectItem value="9">Settembre</SelectItem>
                        <SelectItem value="10">Ottobre</SelectItem>
                        <SelectItem value="11">Novembre</SelectItem>
                        <SelectItem value="12">Dicembre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Statistics Display */}
                <div className="space-y-4">
                  {/* Total All Time */}
                  <div className="p-6 bg-gradient-to-br from-tennis-court/10 to-tennis-ball/10 rounded-lg border-2 border-tennis-court/30">
                    <div className="text-center">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Totale Partite (Tutti gli Anni)</p>
                      <p className="text-5xl font-bold text-tennis-court">{matchStats.total}</p>
                    </div>
                  </div>

                  {/* Year Total */}
                  <div className="p-5 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-center">
                      <p className="text-sm font-medium text-blue-700 mb-2">Partite nel {statsYear}</p>
                      <p className="text-4xl font-bold text-blue-600">{matchStats.yearTotal}</p>
                    </div>
                  </div>

                  {/* Month Total (if month selected) */}
                  {statsMonth !== "all" && (
                    <div className="p-5 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="text-center">
                        <p className="text-sm font-medium text-purple-700 mb-2">
                          Partite in {["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                            "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"][parseInt(statsMonth) - 1]} {statsYear}
                        </p>
                        <p className="text-4xl font-bold text-purple-600">{matchStats.monthTotal}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-600">
                    ℹ️ Vengono contate solo le partite completate (escluse quelle programmate)
                  </p>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Feature 10: Email Errors */}
        <AccordionItem value="email-errors" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <span className="font-semibold">Errori Invio Email</span>
              {emailErrors.length > 0 && (
                <Badge variant="destructive" className="ml-2">{emailErrors.length}</Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Errori Invio Email
                </CardTitle>
                <CardDescription>
                  Visualizza gli errori di invio email per le sfide
                </CardDescription>
              </CardHeader>
              <CardContent>
                {emailErrors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>Nessun errore di invio email!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {emailErrors.map((error) => (
                      <div
                        key={error.id}
                        className="p-4 border rounded-lg bg-red-50 border-red-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm">
                              {error.challenge_type === 'launched' && '🎾 Sfida Lanciata'}
                              {error.challenge_type === 'accepted' && '✅ Sfida Accettata'}
                              {error.challenge_type === 'scheduled' && '📅 Sfida Programmata'}
                              {error.challenge_type === 'reminder' && '⏰ Promemoria'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(error.created_at).toLocaleString('it-IT')}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                const { error: deleteError } = await supabase
                                  .from("email_errors")
                                  .delete()
                                  .eq("id", error.id);

                                if (deleteError) throw deleteError;

                                toast({
                                  title: "Successo",
                                  description: "Errore rimosso",
                                });
                                loadEmailErrors();
                              } catch (err: any) {
                                toast({
                                  title: "Errore",
                                  description: err.message,
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Rimuovi
                          </Button>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p>
                            <strong>Da:</strong> {error.sender_name}
                          </p>
                          <p>
                            <strong>A:</strong> {error.recipient_name} ({error.recipient_email})
                          </p>
                          {error.match_id && (
                            <p className="text-xs text-muted-foreground">
                              ID Sfida: {error.match_id}
                            </p>
                          )}
                          <div className="mt-2 p-2 bg-white rounded border border-red-300">
                            <p className="text-xs font-semibold text-red-700 mb-1">Errore:</p>
                            <p className="text-xs text-red-600">{error.error_message}</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {emailErrors.length > 0 && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from("email_errors")
                              .delete()
                              .neq("id", "00000000-0000-0000-0000-000000000000");

                            if (error) throw error;

                            toast({
                              title: "Successo",
                              description: "Tutti gli errori sono stati rimossi",
                            });
                            loadEmailErrors();
                          } catch (err: any) {
                            toast({
                              title: "Errore",
                              description: err.message,
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        Rimuovi Tutti gli Errori
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Trophy Assignment Dialog */}
      <AssignTournamentTrophyDialog
        open={showTournamentDialog}
        onOpenChange={setShowTournamentDialog}
        championshipId={trophyChampionship}
      />
    </div>
  );
}

