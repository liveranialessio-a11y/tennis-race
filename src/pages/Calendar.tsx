import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, MapPin, Users, Clock } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: string;
  accepted_date: string | null;
  location?: string;
  notes?: string;
}

const Calendar_Page = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [challengesResult, profilesResult] = await Promise.all([
        supabase
          .from('challenges')
          .select('*')
          .eq('status', 'accepted')
          .not('accepted_date', 'is', null),
        supabase.from('profiles').select('*')
      ]);

      if (challengesResult.error) throw challengesResult.error;
      if (profilesResult.error) throw profilesResult.error;

      setChallenges(challengesResult.data || []);
      setProfiles(profilesResult.data || []);
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

  const getProfile = (userId: string) => {
    return profiles.find(p => p.user_id === userId);
  };

  const getChallengesForDate = (date: Date) => {
    return challenges.filter(challenge => {
      if (!challenge.accepted_date) return false;
      return isSameDay(parseISO(challenge.accepted_date), date);
    });
  };

  const getDatesWithChallenges = () => {
    return challenges
      .filter(c => c.accepted_date)
      .map(c => parseISO(c.accepted_date!));
  };

  const selectedDateChallenges = selectedDate ? getChallengesForDate(selectedDate) : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <CalendarIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Calendario Sfide</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Seleziona una Data</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={it}
              className="rounded-md border"
              modifiers={{
                hasChallenge: getDatesWithChallenges()
              }}
              modifiersStyles={{
                hasChallenge: {
                  fontWeight: 'bold',
                  textDecoration: 'underline',
                  color: 'hsl(var(--primary))'
                }
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {selectedDate ? format(selectedDate, 'dd MMMM yyyy', { locale: it }) : 'Seleziona una data'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-muted-foreground">Caricamento...</div>
            ) : selectedDateChallenges.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nessuna sfida programmata per questa data</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDateChallenges.map((challenge) => {
                  const challenger = getProfile(challenge.challenger_id);
                  const challenged = getProfile(challenge.challenged_id);
                  const isChallenger = challenge.challenger_id === user?.id;
                  const opponent = isChallenger ? challenged : challenger;

                  return (
                    <Card key={challenge.id} className="border-primary/20">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={opponent?.avatar_url} />
                            <AvatarFallback>
                              {opponent?.first_name?.[0]}{opponent?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="font-semibold">
                              {opponent?.first_name} {opponent?.last_name}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {isChallenger ? 'Hai sfidato' : 'Ti ha sfidato'}
                            </Badge>
                          </div>
                        </div>

                        {challenge.location && (
                          <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{challenge.location}</span>
                          </div>
                        )}

                        {challenge.notes && (
                          <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                            {challenge.notes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tutte le Sfide Programmate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground">Caricamento...</div>
          ) : challenges.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nessuna sfida programmata al momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {challenges.map((challenge) => {
                const challenger = getProfile(challenge.challenger_id);
                const challenged = getProfile(challenge.challenged_id);
                const isChallenger = challenge.challenger_id === user?.id;
                const opponent = isChallenger ? challenged : challenger;

                return (
                  <Card key={challenge.id} className="border-primary/20">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={opponent?.avatar_url} />
                          <AvatarFallback>
                            {opponent?.first_name?.[0]}{opponent?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">
                            {opponent?.first_name} {opponent?.last_name}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {isChallenger ? 'Hai sfidato' : 'Ti ha sfidato'}
                          </Badge>
                        </div>
                      </div>

                      {challenge.accepted_date && (
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarIcon className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {format(parseISO(challenge.accepted_date), 'dd MMM yyyy', { locale: it })}
                          </span>
                        </div>
                      )}

                      {challenge.location && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span className="truncate">{challenge.location}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Calendar_Page;
