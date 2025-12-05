import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useSuspension } from '@/hooks/useSuspension';

interface SuspensionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SuspensionDialog: React.FC<SuspensionDialogProps> = ({
  open,
  onOpenChange
}) => {
  const { createSuspension, suspension, removeSuspension } = useSuspension();
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!endDate || !reason.trim()) {
      return;
    }

    setLoading(true);
    const result = await createSuspension(
      new Date(startDate + 'T00:00:00'),
      new Date(endDate + 'T23:59:59'),
      reason.trim()
    );
    setLoading(false);

    if (result.success) {
      onOpenChange(false);
      setReason('');
      setStartDate(today);
      setEndDate('');
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    const result = await removeSuspension();
    setLoading(false);

    if (result.success) {
      onOpenChange(false);
    }
  };

  const isValid = endDate && reason.trim().length > 0 && reason.trim().length <= 200 && endDate > startDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {suspension ? 'Gestisci Sospensione' : 'Modifica Stato'}
          </DialogTitle>
          <DialogDescription>
            {suspension
              ? 'Puoi rimuovere la sospensione in anticipo o prolungarla.'
              : 'Imposta un periodo in cui non sarai disponibile per ricevere sfide.'}
          </DialogDescription>
        </DialogHeader>

        {suspension ? (
          <div className="space-y-4">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 backdrop-blur-sm">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
                Sospensione attiva
              </p>
              <div className="space-y-1 text-sm text-orange-800 dark:text-orange-200">
                <p>
                  <span className="font-medium">Inizio:</span>{' '}
                  {format(new Date(suspension.start_date), 'dd/MM/yyyy', { locale: it })}
                </p>
                <p>
                  <span className="font-medium">Fine:</span>{' '}
                  {format(new Date(suspension.end_date), 'dd/MM/yyyy', { locale: it })}
                </p>
                <p>
                  <span className="font-medium">Motivo:</span> {suspension.reason}
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Chiudi
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemove}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? 'Rimozione...' : 'Rimuovi Sospensione'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data Inizio</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={today}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">Data Fine</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">
                Motivo <span className="text-muted-foreground text-xs">({reason.length}/200)</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Es: Infortunio al braccio, non posso giocare per un mese"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 200))}
                rows={4}
                maxLength={200}
              />
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Annulla
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValid || loading}
                className="w-full sm:w-auto"
              >
                {loading ? 'Creazione...' : 'Conferma Sospensione'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
