import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SuspendedPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SuspendedPlayerDialog: React.FC<SuspendedPlayerDialogProps> = ({
  open,
  onOpenChange
}) => {
  const navigate = useNavigate();

  const handleGoToProfile = () => {
    onOpenChange(false);
    navigate('/profile');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Account sospeso
          </DialogTitle>
          <DialogDescription>
            Non puoi effettuare questa azione
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm text-orange-900 dark:text-orange-100">
              Il tuo account risulta temporaneamente sospeso. Non puoi lanciare sfide o creare nuove partite finché la sospensione è attiva.
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Puoi modificare il tuo stato dalla pagina del profilo
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Annulla
          </Button>
          <Button
            onClick={handleGoToProfile}
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600"
          >
            Modifica Stato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
