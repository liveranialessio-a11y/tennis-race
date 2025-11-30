import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, CheckCircle, XCircle } from 'lucide-react';

const EmailConfirmed: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const checkEmailConfirmation = async () => {
      try {
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          setStatus('error');
          setErrorMessage('Errore durante la verifica della sessione');
          return;
        }

        if (session && session.user.email_confirmed_at) {
          // Email confirmed successfully
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage('Email non ancora confermata');
        }
      } catch (error) {
        console.error('Error:', error);
        setStatus('error');
        setErrorMessage('Si è verificato un errore imprevisto');
      }
    };

    checkEmailConfirmation();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          <p className="text-slate-300 mt-4">Verifica in corso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <Card className="border border-slate-700/50 shadow-2xl bg-slate-800/90 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center pb-6">
            <div className="flex justify-center">
              {status === 'success' ? (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <CheckCircle className="h-9 w-9 text-white" strokeWidth={2} />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <XCircle className="h-9 w-9 text-white" strokeWidth={2} />
                </div>
              )}
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-white">
                {status === 'success' ? 'Email Confermata!' : 'Errore'}
              </CardTitle>
              <CardDescription className="text-base text-slate-400 mt-2">
                {status === 'success'
                  ? 'Il tuo account è stato attivato con successo'
                  : errorMessage
                }
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {status === 'success' ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <p className="text-sm text-slate-300 text-center">
                    Il tuo account è stato confermato con successo!
                  </p>
                  <p className="text-sm text-slate-300 text-center mt-2">
                    Ora l'amministratore deve approvare la tua richiesta di registrazione.
                  </p>
                </div>

                <div className="space-y-3 text-sm text-slate-300">
                  <p className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>Email verificata</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">⏳</span>
                    <span>In attesa di approvazione amministratore</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-slate-500 mt-0.5">○</span>
                    <span>Riceverai un'email quando sarai approvato</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-sm text-slate-300 text-center">
                  Si è verificato un problema durante la conferma dell'email.
                </p>
                <p className="text-sm text-slate-300 text-center mt-2">
                  Contatta il supporto se il problema persiste.
                </p>
              </div>
            )}

            <Button
              onClick={() => navigate('/login')}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all duration-200"
            >
              Vai al Login
            </Button>
          </CardContent>
        </Card>

        <div className="text-center mt-8 text-xs text-slate-500">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-400">Tennis Race © 2025</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmed;
