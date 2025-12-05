import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle, CalendarIcon } from 'lucide-react';
import { useSuspension } from '@/hooks/useSuspension';

interface ReactivationPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReactivationPopup: React.FC<ReactivationPopupProps> = ({
  open,
  onOpenChange
}) => {
  const { suspension, removeSuspension, extendSuspension } = useSuspension();
  const [extending, setExtending] = useState(false);
  const [newEndDate, setNewEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const handleRemove = async () => {
    setLoading(true);
    const result = await removeSuspension();
    setLoading(false);

    if (result.success) {
      sessionStorage.removeItem('reactivation_popup_shown');
      onOpenChange(false);
      // Reload page to update all data
      window.location.reload();
    }
  };

  const handleExtend = async () => {
    if (!newEndDate) return;

    setLoading(true);
    const result = await extendSuspension(new Date(newEndDate + 'T23:59:59'));
    setLoading(false);

    if (result.success) {
      sessionStorage.removeItem('reactivation_popup_shown');
      onOpenChange(false);
      setExtending(false);
      setNewEndDate('');
      // Reload page to update all data
      window.location.reload();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[500px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Sospensione Scaduta
          </DialogTitle>
          <DialogDescription>
            La tua sospensione è terminata. Puoi tornare a giocare o prolungarla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
              La tua sospensione è scaduta!
            </p>
            {suspension && (
              <p className="text-xs text-green-800 dark:text-green-200">
                Motivo: {suspension.reason}
              </p>
            )}
          </div>

          {!extending ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Vuoi tornare a giocare o prolungare la sospensione?
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="extend-date">Nuova Data Fine</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="extend-date"
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  min={today}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                La sospensione verrà prolungata con lo stesso motivo
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!extending ? (
            <>
              <Button
                variant="outline"
                onClick={() => setExtending(true)}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Prolunga Sospensione
              </Button>
              <Button
                onClick={handleRemove}
                disabled={loading}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
              >
                {loading ? 'Rimozione...' : 'Torna a Giocare'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setExtending(false);
                  setNewEndDate('');
                }}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Annulla
              </Button>
              <Button
                onClick={handleExtend}
                disabled={!newEndDate || loading}
                className="w-full sm:w-auto"
              >
                {loading ? 'Prolungamento...' : 'Conferma Proroga'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
