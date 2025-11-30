import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Trophy } from 'lucide-react';

interface Match {
  id: string;
  created_at: string;
  player1_id: string;
  player2_id: string;
  winner_id: string;
  player1_sets: number[];
  player2_sets: number[];
  player1: { first_name: string; last_name: string; avatar_url?: string };
  player2: { first_name: string; last_name: string; avatar_url?: string };
  challenge: { challenge_number: number };
}

const MatchHistory: React.FC = () => {
  const { userId, type } = useParams<{ userId: string; type: 'won' | 'lost' }>();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId && type) {
      fetchMatches();
    }
  }, [userId, type]);

  const fetchMatches = async () => {
    if (!userId || !type) return;
    
    try {
      // Get player name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileData) {
        setPlayerName(`${profileData.first_name} ${profileData.last_name}`);
      }

      // Fetch matches based on type
      let query = supabase
        .from('match_results')
        .select(`
          *,
          player1:profiles!match_results_player1_id_fkey(first_name, last_name, avatar_url),
          player2:profiles!match_results_player2_id_fkey(first_name, last_name, avatar_url),
          challenge:challenges!match_results_challenge_id_fkey(challenge_number)
        `)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq('status', 'validated');

      // Filter by won or lost
      if (type === 'won') {
        query = query.eq('winner_id', userId);
      } else if (type === 'lost') {
        query = query.neq('winner_id', userId);
      }

      const { data } = await query.order('created_at', { ascending: false });
      setMatches(data || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-tennis-court/5 via-background to-tennis-ball/5 min-h-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-tennis-court">
          Partite {type === 'won' ? 'Vinte' : 'Perse'}
        </h1>
        <p className="text-muted-foreground">{playerName}</p>
      </div>

      <Card className="border-tennis-court/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-tennis-court">
            <Trophy className="h-5 w-5" />
            {matches.length} Partite {type === 'won' ? 'Vinte' : 'Perse'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {matches.length > 0 ? (
            matches.map((match) => {
              const isPlayer1 = match.player1_id === userId;
              const opponent = isPlayer1 ? match.player2 : match.player1;
              
              return (
                <div 
                  key={match.id} 
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    type === 'won' ? 'bg-tennis-winner/10 border border-tennis-winner/30' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 flex-wrap">
                    <Badge variant="outline" className="font-mono">
                      ID #{match.challenge.challenge_number}
                    </Badge>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={opponent.avatar_url} alt={`${opponent.first_name} ${opponent.last_name}`} />
                      <AvatarFallback>
                        {opponent.first_name.charAt(0)}
                        {opponent.last_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        vs {opponent.first_name} {opponent.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(match.created_at).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex gap-2">
                      {isPlayer1 ? (
                        match.player1_sets.map((score, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {score}-{match.player2_sets[i]}
                          </Badge>
                        ))
                      ) : (
                        match.player2_sets.map((score, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {score}-{match.player1_sets[i]}
                          </Badge>
                        ))
                      )}
                    </div>
                    {type === 'won' && (
                      <Trophy className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna partita {type === 'won' ? 'vinta' : 'persa'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchHistory;
