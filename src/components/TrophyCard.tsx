import React from 'react';
import { Trophy, Award, Medal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface TrophyCardProps {
  trophyType: 'pro_master_rank' | 'live_rank' | 'tournament';
  position: number;
  tournamentTitle?: string | null;
  awardedDate: string;
}

const TrophyCard: React.FC<TrophyCardProps> = ({
  trophyType,
  position,
  tournamentTitle,
  awardedDate,
}) => {
  const getPositionColor = (pos: number) => {
    switch (pos) {
      case 1:
        return {
          bg: 'from-yellow-50 to-amber-100 dark:from-yellow-950/30 dark:to-amber-950/30',
          border: 'border-yellow-400 dark:border-yellow-600',
          icon: 'text-yellow-600 dark:text-yellow-400',
        };
      case 2:
        return {
          bg: 'from-gray-50 to-slate-200 dark:from-gray-950/30 dark:to-slate-900/30',
          border: 'border-gray-400 dark:border-gray-500',
          icon: 'text-gray-600 dark:text-gray-400',
        };
      case 3:
        return {
          bg: 'from-orange-50 to-amber-100 dark:from-orange-950/30 dark:to-amber-900/30',
          border: 'border-orange-500 dark:border-orange-600',
          icon: 'text-orange-600 dark:text-orange-500',
        };
      default:
        return {
          bg: 'from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30',
          border: 'border-blue-400 dark:border-blue-500',
          icon: 'text-blue-600 dark:text-blue-400',
        };
    }
  };

  const colors = getPositionColor(position);
  const formattedDate = new Date(awardedDate).toLocaleDateString('it-IT', {
    year: 'numeric',
    month: 'short',
  });

  const getPositionLabel = (pos: number) => {
    return `${pos}°`;
  };

  const getTrophyTitle = () => {
    if (trophyType === 'tournament' && tournamentTitle) {
      return tournamentTitle;
    }
    if (trophyType === 'live_rank' && tournamentTitle) {
      return tournamentTitle;
    }
    return `${getPositionLabel(position)} Pro Master`;
  };

  const renderIcon = () => {
    if (trophyType === 'tournament') {
      return <Trophy className={`h-16 w-16 ${colors.icon}`} />;
    }

    // Per Live Rank usiamo l'icona Award (medaglione circolare)
    if (trophyType === 'live_rank') {
      return <Award className={`h-16 w-16 ${colors.icon}`} />;
    }

    // Per Pro Master Rank usiamo le medaglie
    if (position === 1) {
      return <Medal className={`h-16 w-16 ${colors.icon}`} />;
    } else if (position === 2) {
      return <Medal className={`h-16 w-16 ${colors.icon}`} />;
    } else {
      return <Medal className={`h-16 w-16 ${colors.icon}`} />;
    }
  };

  return (
    <Card className={`overflow-hidden bg-gradient-to-br ${colors.bg} border-2 ${colors.border} hover:shadow-lg transition-shadow`}>
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center space-y-3">
          {/* Icon */}
          <div className="relative">
            {renderIcon()}
            {/* Position badge */}
            <div className={`absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-white dark:bg-gray-800 border-2 ${colors.border} flex items-center justify-center`}>
              <span className={`text-sm font-bold ${colors.icon}`}>
                {position}
              </span>
            </div>
          </div>

          {/* Title */}
          <div>
            <h3 className="font-bold text-lg leading-tight">
              {getTrophyTitle()}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {formattedDate}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrophyCard;
