import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { XCircle } from 'lucide-react';

interface UnavailablePlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
}

export const UnavailablePlayerDialog: React.FC<UnavailablePlayerDialogProps> = ({
  open,
  onOpenChange,
  playerName
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            Giocatore non disponibile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm text-red-900 dark:text-red-100">
              {playerName} non è sfidabile perché ha altre sfide in corso o match da registrare.
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Attendi che il giocatore completi le sue sfide attuali prima di lanciarne una nuova
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
