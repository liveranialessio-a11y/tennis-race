import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface SuspensionReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export const SuspensionReasonDialog: React.FC<SuspensionReasonDialogProps> = ({
  open,
  onOpenChange,
  playerName,
  startDate,
  endDate,
  reason
}) => {
  // Don't render if no valid suspension data
  if (!startDate || !endDate || !reason) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Giocatore sospeso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-3">
              {playerName} è temporaneamente non disponibile
            </p>

            <div className="space-y-2 text-sm text-orange-800 dark:text-orange-200">
              <div>
                <span className="font-medium">Periodo:</span>
                <p className="mt-1">
                  Dal {format(new Date(startDate), 'dd/MM/yyyy', { locale: it })} al{' '}
                  {format(new Date(endDate), 'dd/MM/yyyy', { locale: it })}
                </p>
              </div>

              <div>
                <span className="font-medium">Motivo:</span>
                <p className="mt-1">{reason}</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Non è possibile lanciare sfide a questo giocatore durante il periodo di sospensione
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
