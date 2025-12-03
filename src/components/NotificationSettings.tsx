import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Bell, Save } from 'lucide-react';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/services/pushNotifications';

const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState({
    in_app_enabled: true,
    push_enabled: false,
    challenge_received: 'both',
    challenge_accepted: 'both',
    challenge_rejected: 'both',
    challenge_cancelled: 'in_app',
    challenge_reminder_24h: 'push',
    challenge_reminder_2h: 'push',
    match_scheduled: 'both',
    match_time_changed: 'both',
    match_deleted: 'both',
    result_pending: 'both',
    result_confirmed: 'in_app',
    result_contested: 'both',
    result_expiring: 'push',
    ranking_position_change: 'in_app',
    ranking_category_change: 'both',
    ranking_first_place: 'both',
    championship_new_season: 'in_app',
    championship_announcement: 'in_app',
    admin_new_registration: 'in_app',
    admin_contested_result: 'in_app',
    dnd_enabled: false,
    dnd_start_time: '22:00',
    dnd_end_time: '08:00',
  });

  useEffect(() => {
    if (user) {
      loadNotificationPreferences();
      checkPushSubscription();
    }
  }, [user]);

  const checkPushSubscription = async () => {
    const isSubscribed = await isPushSubscribed();
    setNotificationPrefs(prev => ({ ...prev, push_enabled: isSubscribed }));
  };

  const loadNotificationPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from('notification_preferences')
            .insert({ user_id: user?.id });

          if (insertError) throw insertError;
          return;
        }
        throw error;
      }

      if (data) {
        setNotificationPrefs({
          in_app_enabled: data.in_app_enabled,
          push_enabled: data.push_enabled,
          challenge_received: data.challenge_received,
          challenge_accepted: data.challenge_accepted,
          challenge_rejected: data.challenge_rejected,
          challenge_cancelled: data.challenge_cancelled,
          challenge_reminder_24h: data.challenge_reminder_24h,
          challenge_reminder_2h: data.challenge_reminder_2h,
          match_scheduled: data.match_scheduled ?? 'both',
          match_time_changed: data.match_time_changed ?? 'both',
          match_deleted: data.match_deleted ?? 'both',
          result_pending: data.result_pending,
          result_confirmed: data.result_confirmed,
          result_contested: data.result_contested,
          result_expiring: data.result_expiring,
          ranking_position_change: data.ranking_position_change,
          ranking_category_change: data.ranking_category_change,
          ranking_first_place: data.ranking_first_place,
          championship_new_season: data.championship_new_season,
          championship_announcement: data.championship_announcement,
          admin_new_registration: data.admin_new_registration,
          admin_contested_result: data.admin_contested_result,
          dnd_enabled: data.dnd_enabled,
          dnd_start_time: data.dnd_start_time ? data.dnd_start_time.substring(0, 5) : '22:00',
          dnd_end_time: data.dnd_end_time ? data.dnd_end_time.substring(0, 5) : '08:00',
        });
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const saveNotificationPreferences = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('notification_preferences')
        .update({
          ...notificationPrefs,
          dnd_start_time: notificationPrefs.dnd_start_time + ':00',
          dnd_end_time: notificationPrefs.dnd_end_time + ':00',
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: 'Preferenze salvate',
        description: 'Le tue preferenze di notifica sono state aggiornate',
      });
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Attivazione Generale */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-tennis-court" />
            <CardTitle>Notifiche</CardTitle>
          </div>
          <CardDescription>
            Gestisci le notifiche in-app e push
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="in-app-enabled">Notifiche In-App</Label>
              <p className="text-sm text-muted-foreground">
                Visualizza notifiche nell'applicazione
              </p>
            </div>
            <Switch
              id="in-app-enabled"
              checked={notificationPrefs.in_app_enabled}
              onCheckedChange={(checked) =>
                setNotificationPrefs({ ...notificationPrefs, in_app_enabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-enabled">Notifiche Push</Label>
              <p className="text-sm text-muted-foreground">
                Ricevi notifiche anche quando l'app è chiusa
              </p>
            </div>
            <Switch
              id="push-enabled"
              checked={notificationPrefs.push_enabled}
              onCheckedChange={async (checked) => {
                if (!user) return;

                setLoading(true);
                try {
                  if (checked) {
                    const success = await subscribeToPush(user.id);
                    if (!success) {
                      toast({
                        title: 'Errore',
                        description: 'Impossibile attivare le notifiche push. Controlla i permessi del browser.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    toast({
                      title: 'Push attivate!',
                      description: 'Riceverai notifiche anche con app chiusa',
                    });
                  } else {
                    await unsubscribeFromPush(user.id);
                    toast({
                      title: 'Push disattivate',
                      description: 'Non riceverai più notifiche push',
                    });
                  }
                  setNotificationPrefs({ ...notificationPrefs, push_enabled: checked });
                } catch (error) {
                  toast({
                    title: 'Errore',
                    description: 'Errore durante la gestione delle notifiche push',
                    variant: 'destructive',
                  });
                } finally {
                  setLoading(false);
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifiche Sfide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sfide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationRow
            label="Nuova sfida ricevuta"
            description="Quando qualcuno ti lancia una sfida"
            value={notificationPrefs.challenge_received}
            onChange={(value) =>
              setNotificationPrefs({ ...notificationPrefs, challenge_received: value })
            }
          />
          <NotificationRow
            label="Sfida accettata"
            description="Quando un giocatore accetta la tua sfida"
            value={notificationPrefs.challenge_accepted}
            onChange={(value) =>
              setNotificationPrefs({ ...notificationPrefs, challenge_accepted: value })
            }
          />
          <NotificationRow
            label="Sfida rifiutata"
            description="Quando un giocatore rifiuta la tua sfida"
            value={notificationPrefs.challenge_rejected}
            onChange={(value) =>
              setNotificationPrefs({ ...notificationPrefs, challenge_rejected: value })
            }
          />
        </CardContent>
      </Card>

      {/* Notifiche Risultati */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Risultati Partite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationRow
            label="Partita programmata"
            description="Quando viene fissata la data e ora di una partita"
            value={notificationPrefs.match_scheduled}
            onChange={(value) =>
              setNotificationPrefs({ ...notificationPrefs, match_scheduled: value })
            }
          />
          <NotificationRow
            label="Orario modificato"
            description="Quando viene modificato l'orario di una partita programmata"
            value={notificationPrefs.match_time_changed}
            onChange={(value) =>
              setNotificationPrefs({ ...notificationPrefs, match_time_changed: value })
            }
          />
          <NotificationRow
            label="Partita eliminata"
            description="Quando una partita o sfida viene eliminata"
            value={notificationPrefs.match_deleted}
            onChange={(value) =>
              setNotificationPrefs({ ...notificationPrefs, match_deleted: value })
            }
          />
          <NotificationRow
            label="Risultato inserito"
            description="Quando viene inserito un nuovo risultato di una tua partita"
            value={notificationPrefs.result_pending}
            onChange={(value) =>
              setNotificationPrefs({ ...notificationPrefs, result_pending: value })
            }
          />
        </CardContent>
      </Card>

      {/* Notifiche Classifica */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Classifica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationRow
            label="Cambio posizione"
            description="Quando sali o scendi in classifica"
            value={notificationPrefs.ranking_position_change}
            onChange={(value) =>
              setNotificationPrefs({ ...notificationPrefs, ranking_position_change: value })
            }
          />
          <NotificationRow
            label="Primo posto"
            description="Quando raggiungi il primo posto"
            value={notificationPrefs.ranking_first_place}
            onChange={(value) =>
              setNotificationPrefs({ ...notificationPrefs, ranking_first_place: value })
            }
          />
        </CardContent>
      </Card>

      {/* Non Disturbare */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Non Disturbare</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="dnd-enabled">Attiva Non Disturbare</Label>
              <p className="text-sm text-muted-foreground">
                Silenzia le notifiche negli orari impostati
              </p>
            </div>
            <Switch
              id="dnd-enabled"
              checked={notificationPrefs.dnd_enabled}
              onCheckedChange={(checked) =>
                setNotificationPrefs({ ...notificationPrefs, dnd_enabled: checked })
              }
            />
          </div>

          {notificationPrefs.dnd_enabled && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="dnd-start">Dalle</Label>
                <Input
                  id="dnd-start"
                  type="time"
                  value={notificationPrefs.dnd_start_time}
                  onChange={(e) =>
                    setNotificationPrefs({ ...notificationPrefs, dnd_start_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dnd-end">Alle</Label>
                <Input
                  id="dnd-end"
                  type="time"
                  value={notificationPrefs.dnd_end_time}
                  onChange={(e) =>
                    setNotificationPrefs({ ...notificationPrefs, dnd_end_time: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Salva preferenze */}
      <Button onClick={saveNotificationPreferences} disabled={loading} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {loading ? 'Salvataggio...' : 'Salva Preferenze'}
      </Button>
    </div>
  );
};

// Componente helper per le righe di notifica
const NotificationRow: React.FC<{
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, description, value, onChange }) => {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="space-y-0.5 flex-1 mr-4">
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nessuna</SelectItem>
          <SelectItem value="in_app">In-App</SelectItem>
          <SelectItem value="push">Push</SelectItem>
          <SelectItem value="both">Entrambe</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default NotificationSettings;
