import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trophy, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Challenge {
  id: string;
  challenge_number: number;
  challenger_id: string;
  challenged_id: string;
  status: string;
  location: string | null;
  accepted_date: string | null;
  challenger: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
  challenged: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

interface MatchResult {
  id: string;
  challenge_id: string;
  player1_id: string;
  player2_id: string;
  player1_sets: number[];
  player2_sets: number[];
  winner_id: string;
  status: string;
  submitted_by: string;
  validated_by: string | null;
  created_at: string;
  player1: {
    first_name: string;
    last_name: string;
  };
  player2: {
    first_name: string;
    last_name: string;
  };
  submitter: {
    first_name: string;
    last_name: string;
  };
  challenge: {
    challenge_number: number;
  };
}

export default function MatchResults() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [winnerId, setWinnerId] = useState<string>("");
  const [sets, setSets] = useState<Array<{ player1: string; player2: string }>>([
    { player1: "", player2: "" },
    { player1: "", player2: "" },
  ]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch match results first to filter out completed challenges
      const { data: resultsData, error: resultsError } = await supabase
        .from("match_results")
        .select("challenge_id")
        .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`);

      if (resultsError) throw resultsError;

      const completedChallengeIds = resultsData?.map(r => r.challenge_id) || [];

      // Fetch accepted challenges involving the user that don't have results yet
      const { data: challengesData, error: challengesError } = await supabase
        .from("challenges")
        .select(`
          *,
          challenger:profiles!challenges_challenger_id_fkey(first_name, last_name, avatar_url),
          challenged:profiles!challenges_challenged_id_fkey(first_name, last_name, avatar_url)
        `)
        .eq("status", "accepted")
        .or(`challenger_id.eq.${user?.id},challenged_id.eq.${user?.id}`)
        .not("id", "in", `(${completedChallengeIds.join(",")})`)
        .order("accepted_date", { ascending: false });

      if (challengesError) throw challengesError;

      // Fetch all match results
      const { data: allResultsData, error: allResultsError } = await supabase
        .from("match_results")
        .select(`
          *,
          player1:profiles!match_results_player1_id_fkey(first_name, last_name),
          player2:profiles!match_results_player2_id_fkey(first_name, last_name),
          submitter:profiles!match_results_submitted_by_fkey(first_name, last_name),
          challenge:challenges!match_results_challenge_id_fkey(challenge_number)
        `)
        .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`)
        .order("created_at", { ascending: false });

      if (allResultsError) throw allResultsError;

      setChallenges(challengesData || []);
      setMatchResults(allResultsData || []);
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

  const openResultDialog = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setWinnerId("");
    setSets([
      { player1: "", player2: "" },
      { player1: "", player2: "" },
    ]);
    setDialogOpen(true);
  };

  const addSet = () => {
    if (sets.length < 5) {
      setSets([...sets, { player1: "", player2: "" }]);
    }
  };

  const updateSet = (index: number, player: "player1" | "player2", value: string) => {
    const newSets = [...sets];
    newSets[index][player] = value;
    setSets(newSets);
  };

  const removeSet = (index: number) => {
    if (sets.length > 2) {
      setSets(sets.filter((_, i) => i !== index));
    }
  };


  const submitResult = async () => {
    if (!selectedChallenge || !user) return;

    const player1Sets = sets.map(s => parseInt(s.player1)).filter(n => !isNaN(n));
    const player2Sets = sets.map(s => parseInt(s.player2)).filter(n => !isNaN(n));

    if (player1Sets.length < 2) {
      toast({
        title: "Errore",
        description: "Inserisci almeno 2 set completi",
        variant: "destructive",
      });
      return;
    }

    if (!winnerId) {
      toast({
        title: "Errore",
        description: "Seleziona il vincitore della partita",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Check if result already exists for this challenge
      const { data: existingResult } = await supabase
        .from('match_results')
        .select('id')
        .eq('challenge_id', selectedChallenge.id)
        .maybeSingle();

      if (existingResult) {
        toast({
          title: "Errore",
          description: "Risultato già inserito per questa sfida",
          variant: "destructive",
        });
        setDialogOpen(false);
        setSelectedChallenge(null);
        setWinnerId("");
        setSets([
          { player1: "", player2: "" },
          { player1: "", player2: "" },
        ]);
        setSubmitting(false);
        return;
      }

      // Insert result
      const { data: resultData, error: insertError } = await supabase
        .from("match_results")
        .insert({
          challenge_id: selectedChallenge.id,
          player1_id: selectedChallenge.challenger_id,
          player2_id: selectedChallenge.challenged_id,
          player1_sets: player1Sets,
          player2_sets: player2Sets,
          winner_id: winnerId,
          submitted_by: user.id,
          status: "pending_validation",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Process result immediately
      const { error: fnError } = await supabase.functions.invoke("process-match-result", {
        body: { match_result_id: resultData.id },
      });

      if (fnError) throw fnError;

      toast({
        title: "Risultato registrato",
        description: "Punti e classifica aggiornati",
      });

      setDialogOpen(false);
      setSelectedChallenge(null);
      setWinnerId("");
      setSets([
        { player1: "", player2: "" },
        { player1: "", player2: "" },
      ]);
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "validated":
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Completato</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Risultati Partite</h1>
          <p className="text-muted-foreground">Inserisci e valida i risultati delle sfide</p>
        </div>
      </div>

      {/* Challenges to report */}
      <Card>
        <CardHeader>
          <CardTitle>Sfide da Completare</CardTitle>
          <CardDescription>Inserisci il risultato delle sfide completate</CardDescription>
        </CardHeader>
        <CardContent>
          {challenges.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nessuna sfida accettata da completare</p>
          ) : (
            <div className="space-y-4">
              {challenges.map((challenge) => (
                <Card key={challenge.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="font-mono">
                          ID #{challenge.challenge_number}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">
                            {challenge.challenger.first_name} {challenge.challenger.last_name}
                          </div>
                          <span className="text-muted-foreground">vs</span>
                          <div className="font-medium">
                            {challenge.challenged.first_name} {challenge.challenged.last_name}
                          </div>
                        </div>
                        {challenge.location && (
                          <Badge variant="outline">{challenge.location}</Badge>
                        )}
                      </div>
                      <Button onClick={() => openResultDialog(challenge)}>
                        Inserisci Risultato
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match results history */}
      <Card>
        <CardHeader>
          <CardTitle>Storico Risultati</CardTitle>
          <CardDescription>Tutti i risultati delle tue partite</CardDescription>
        </CardHeader>
        <CardContent>
          {matchResults.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nessun risultato registrato</p>
          ) : (
            <div className="space-y-4">
              {matchResults.map((result) => (
                <Card key={result.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-4 flex-wrap">
                          <Badge variant="outline" className="font-mono">
                            ID #{result.challenge.challenge_number}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <div className="font-medium">
                              {result.player1.first_name} {result.player1.last_name}
                            </div>
                            {result.winner_id === result.player1_id && (
                              <Trophy className="w-4 h-4 text-yellow-500" />
                            )}
                          </div>
                          <div className="flex gap-2">
                            {result.player1_sets.map((score, i) => (
                              <Badge key={i} variant="outline">
                                {score}-{result.player2_sets[i]}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            {result.winner_id === result.player2_id && (
                              <Trophy className="w-4 h-4 text-yellow-500" />
                            )}
                            <div className="font-medium">
                              {result.player2.first_name} {result.player2.last_name}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(result.status)}
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        Inserito da: {result.submitter.first_name} {result.submitter.last_name}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result input dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inserisci Risultato</DialogTitle>
            <DialogDescription>
              {selectedChallenge && (
                <div className="mt-2">
                  {selectedChallenge.challenger.first_name} {selectedChallenge.challenger.last_name} vs{" "}
                  {selectedChallenge.challenged.first_name} {selectedChallenge.challenged.last_name}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {sets.map((set, index) => (
              <div key={index} className="flex items-center gap-2">
                <Label className="w-16">Set {index + 1}</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={set.player1}
                  onChange={(e) => updateSet(index, "player1", e.target.value)}
                  className="w-20"
                />
                <span>-</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={set.player2}
                  onChange={(e) => updateSet(index, "player2", e.target.value)}
                  className="w-20"
                />
                {sets.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSet(index)}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}

            {sets.length < 5 && (
              <Button variant="outline" onClick={addSet} className="w-full">
                Aggiungi Set
              </Button>
            )}

            <div className="space-y-2 pt-4 border-t">
              <Label>Vincitore</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={winnerId === selectedChallenge?.challenger_id ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setWinnerId(selectedChallenge?.challenger_id || "")}
                >
                  {selectedChallenge?.challenger.first_name} {selectedChallenge?.challenger.last_name}
                </Button>
                <Button
                  type="button"
                  variant={winnerId === selectedChallenge?.challenged_id ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setWinnerId(selectedChallenge?.challenged_id || "")}
                >
                  {selectedChallenge?.challenged.first_name} {selectedChallenge?.challenged.last_name}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={submitResult} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Invia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
