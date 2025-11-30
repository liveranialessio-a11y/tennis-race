import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Player {
  id: string;
  user_id: string;
  display_name: string;
  championship_id: string;
}

interface AssignTournamentTrophyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  championshipId: string;
}

const AssignTournamentTrophyDialog: React.FC<AssignTournamentTrophyDialogProps> = ({
  open,
  onOpenChange,
  championshipId,
}) => {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [position, setPosition] = useState('');
  const [tournamentTitle, setTournamentTitle] = useState('');

  useEffect(() => {
    if (open && championshipId) {
      loadPlayers();
    }
  }, [open, championshipId]);

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, user_id, display_name, championship_id')
        .eq('championship_id', championshipId)
        .order('display_name');

      if (error) throw error;
      setPlayers(data || []);
    } catch (error: any) {
      console.error('Error loading players:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i giocatori',
        variant: 'destructive',
      });
    }
  };

  const handleAssign = async () => {
    if (!selectedPlayerId || !position || !tournamentTitle) {
      toast({
        title: 'Errore',
        description: 'Compila tutti i campi richiesti',
        variant: 'destructive',
      });
      return;
    }

    const positionNum = parseInt(position);
    if (isNaN(positionNum) || positionNum < 1 || positionNum > 3) {
      toast({
        title: 'Errore',
        description: 'La posizione deve essere 1, 2 o 3',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('trophies').insert({
        player_id: selectedPlayerId,
        championship_id: championshipId,
        trophy_type: 'tournament',
        position: positionNum,
        tournament_title: tournamentTitle,
        awarded_date: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: 'Successo',
        description: 'Trofeo torneo assegnato con successo',
      });

      // Reset form
      setSelectedPlayerId('');
      setPosition('');
      setTournamentTitle('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error assigning trophy:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile assegnare il trofeo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assegna Trofeo Torneo</DialogTitle>
          <DialogDescription>
            Assegna un trofeo torneo ad un giocatore
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="player-select">Giocatore</Label>
            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger id="player-select">
                <SelectValue placeholder="Seleziona giocatore" />
              </SelectTrigger>
              <SelectContent>
                {players.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position-select">Posizione</Label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger id="position-select">
                <SelectValue placeholder="Seleziona posizione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1°</SelectItem>
                <SelectItem value="2">2°</SelectItem>
                <SelectItem value="3">3°</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tournament-title">Titolo Torneo</Label>
            <Input
              id="tournament-title"
              value={tournamentTitle}
              onChange={(e) => setTournamentTitle(e.target.value)}
              placeholder="es. Roland Garros"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleAssign} disabled={loading}>
            {loading ? 'Assegnando...' : 'Assegna Trofeo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignTournamentTrophyDialog;
