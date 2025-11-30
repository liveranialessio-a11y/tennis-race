import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, XCircle } from "lucide-react";
import TennisLoadingAnimation from "@/components/TennisLoadingAnimation";

interface RegistrationRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  rejected_reason?: string;
}

export default function PendingRegistration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<RegistrationRequest | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      setUserId(user.id);

      // Check if user already has a player record (approved)
      const { data: playerData } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (playerData) {
        // User is already approved, redirect to home
        navigate('/');
        return;
      }

      // Check registration request status
      const { data: requestData, error } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching registration request:', error);
        return;
      }

      if (!requestData) {
        // No request found, user should create one
        navigate('/');
        return;
      }

      setRequest(requestData);

    } catch (error) {
      console.error('Error checking registration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return <TennisLoadingAnimation />;
  }

  // Show rejected state
  if (request?.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-2xl border-2 border-destructive/30">
          <CardHeader className="text-center space-y-6 pb-8">
            <div className="mx-auto w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center border-2 border-destructive/50">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-destructive">
                Richiesta Rifiutata
              </CardTitle>
              <CardDescription className="text-base mt-4 text-muted-foreground">
                La tua richiesta di registrazione è stata rifiutata dall'amministratore
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {request.rejected_reason && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-destructive mb-2">Motivo:</p>
                <p className="text-sm text-muted-foreground">{request.rejected_reason}</p>
              </div>
            )}

            <div className="text-center text-sm text-muted-foreground">
              <p>Puoi contattare l'amministratore per maggiori informazioni o richiedere una nuova registrazione.</p>
            </div>

            <div className="pt-4 space-y-3">
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full h-12 border-destructive/50 hover:bg-destructive/10 text-base"
              >
                Esci
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show pending state (default)
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-2 border-tennis-court/30">
        <CardHeader className="text-center space-y-6 pb-8">
          <div className="mx-auto w-20 h-20 bg-tennis-court/20 rounded-full flex items-center justify-center border-2 border-tennis-court/50 animate-pulse">
            <Clock className="h-10 w-10 text-tennis-court" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-tennis-court">
              Richiesta di Registrazione Effettuata
            </CardTitle>
            <CardDescription className="text-base mt-4 text-muted-foreground">
              La tua richiesta è in attesa di approvazione da parte dell'amministratore
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="pt-6 space-y-3">
            <Button
              onClick={checkRegistrationStatus}
              variant="outline"
              className="w-full h-12 border-tennis-court/50 hover:bg-tennis-court/10 text-base"
            >
              Aggiorna Stato
            </Button>

            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="w-full h-12 hover:bg-muted text-base"
            >
              Esci
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
