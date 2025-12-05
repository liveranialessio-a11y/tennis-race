import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Megaphone,
  Swords,
  CheckCircle,
  XCircle,
  Trophy,
  FileCheck,
  AlertCircle,
  Trash2,
  Check
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  related_id: string | null;
  related_type: string | null;
  icon: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
}

const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  loading,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
}) => {
  const navigate = useNavigate();

  const getIcon = (iconName: string | null) => {
    const iconClass = "h-5 w-5";
    switch (iconName) {
      case 'megaphone':
        return <Megaphone className={iconClass} />;
      case 'swords':
        return <Swords className={iconClass} />;
      case 'check-circle':
        return <CheckCircle className={`${iconClass} text-green-500`} />;
      case 'x-circle':
        return <XCircle className={`${iconClass} text-red-500`} />;
      case 'trophy':
        return <Trophy className={`${iconClass} text-yellow-500`} />;
      case 'file-check':
        return <FileCheck className={iconClass} />;
      case 'alert-circle':
        return <AlertCircle className={`${iconClass} text-orange-500`} />;
      default:
        return <Megaphone className={iconClass} />;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Elimina la notifica invece di marcarla come letta
    onDelete(notification.id);

    // Naviga alla pagina appropriata
    if (notification.related_type === 'challenge') {
      navigate('/challenges');
    } else if (notification.related_type === 'match') {
      navigate('/match-results');
    } else if (notification.related_type === 'ranking') {
      navigate('/ranking');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Caricamento notifiche...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center">
        <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">Nessuna notifica</p>
      </div>
    );
  }

  return (
    <div className="max-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-card z-10">
        <div>
          <h3 className="font-semibold">Notifiche</h3>
          {unreadCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {unreadCount} non {unreadCount === 1 ? 'letta' : 'lette'}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            className="text-xs"
          >
            <Check className="h-4 w-4 mr-1" />
            Segna tutte lette
          </Button>
        )}
      </div>

      {/* Lista notifiche */}
      <ScrollArea className="h-full">
        <div className="divide-y">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 hover:bg-accent/50 cursor-pointer transition-colors relative group ${
                !notification.is_read ? 'bg-accent/20' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start gap-3">
                {/* Icona */}
                <div className="mt-1 flex-shrink-0">
                  {getIcon(notification.icon)}
                </div>

                {/* Contenuto */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm leading-tight">
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-tennis-court flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: it,
                    })}
                  </p>
                </div>

                {/* Bottone elimina (visibile al hover) */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notification.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

// Aggiungi l'import mancante
import { Bell } from 'lucide-react';

export default NotificationList;
