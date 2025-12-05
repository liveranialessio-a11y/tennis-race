import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type AvailabilityStatus = Database['public']['Enums']['availability_status_enum'];

interface AvailabilityStatusBadgeProps {
  status: AvailabilityStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onClick?: () => void;
  className?: string;
}

export const AvailabilityStatusBadge: React.FC<AvailabilityStatusBadgeProps> = ({
  status,
  size = 'md',
  showLabel = false,
  onClick,
  className
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'available':
        return 'text-green-500 fill-green-500';
      case 'unavailable':
        return 'text-red-500 fill-red-500';
      case 'suspended':
        return 'text-orange-500 fill-orange-500';
      default:
        return 'text-gray-500 fill-gray-500';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'available':
        return 'Disponibile';
      case 'unavailable':
        return 'Non disponibile';
      case 'suspended':
        return 'Sospeso';
      default:
        return 'Sconosciuto';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'w-2 h-2';
      case 'md':
        return 'w-3 h-3';
      case 'lg':
        return 'w-4 h-4';
      default:
        return 'w-3 h-3';
    }
  };

  const isClickable = onClick && status === 'suspended';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2',
        isClickable && 'cursor-pointer hover:opacity-80 transition-opacity',
        className
      )}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <Circle className={cn(getSizeClass(), getStatusColor())} />
      {showLabel && (
        <span className="text-sm text-muted-foreground">{getStatusLabel()}</span>
      )}
    </div>
  );
};
