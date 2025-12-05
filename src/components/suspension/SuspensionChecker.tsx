import { useEffect, useState } from 'react';
import { useSuspension } from '@/hooks/useSuspension';
import { ReactivationPopup } from './ReactivationPopup';

export const SuspensionChecker: React.FC = () => {
  const { suspension, loading } = useSuspension();
  const [showReactivationPopup, setShowReactivationPopup] = useState(false);

  useEffect(() => {
    if (!loading && suspension && suspension.is_expired) {
      // Show popup only once per session using sessionStorage
      const hasShownPopup = sessionStorage.getItem('reactivation_popup_shown');

      if (!hasShownPopup) {
        setShowReactivationPopup(true);
        sessionStorage.setItem('reactivation_popup_shown', 'true');
      }
    }
  }, [suspension, loading]);

  const handleClose = () => {
    setShowReactivationPopup(false);
  };

  return (
    <ReactivationPopup
      open={showReactivationPopup}
      onOpenChange={handleClose}
    />
  );
};
