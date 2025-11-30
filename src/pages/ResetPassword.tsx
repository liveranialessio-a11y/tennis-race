import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trophy, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);

  useEffect(() => {
    // Check if user has a valid recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      } else {
        toast({
          title: "Link non valido",
          description: "Il link di reset è scaduto o non valido. Richiedi un nuovo link.",
          variant: "destructive",
        });
        setTimeout(() => navigate('/'), 3000);
      }
    });
  }, [navigate, toast]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non coincidono",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 6 caratteri",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setIsUpdating(false);

    if (error) {
      console.error('❌ Password update error:', error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password aggiornata!",
        description: "La tua password è stata reimpostata con successo",
      });
      setTimeout(() => navigate('/'), 2000);
    }
  };

  if (!isValidSession) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <Card className="border border-slate-700/50 shadow-2xl bg-slate-800/90 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center pb-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Trophy className="h-9 w-9 text-white" strokeWidth={2} />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-white">
                Nuova Password
              </CardTitle>
              <CardDescription className="text-base text-slate-400 mt-2">
                Scegli una nuova password per il tuo account
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-slate-200">Nuova Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isUpdating}
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {newPassword && newPassword.length < 6 && (
                  <p className="text-xs text-red-600">
                    La password deve essere di almeno 6 caratteri
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-slate-200">Conferma Password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isUpdating}
                  minLength={6}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-600">
                    Le password non coincidono
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/30 transition-all duration-200"
                disabled={
                  isUpdating ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword !== confirmPassword ||
                  newPassword.length < 6
                }
              >
                {isUpdating ? 'Aggiornamento...' : 'Aggiorna Password'}
              </Button>

              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Torna al login
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-8 text-xs text-slate-500">
          <p>Tennis Race © 2025</p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
