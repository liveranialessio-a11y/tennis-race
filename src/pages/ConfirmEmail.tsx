import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Mail, ArrowLeft } from 'lucide-react';

const ConfirmEmail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <Card className="border border-slate-700/50 shadow-2xl bg-slate-800/90 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center pb-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Mail className="h-9 w-9 text-white" strokeWidth={2} />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-white">
                Conferma la tua email
              </CardTitle>
              <CardDescription className="text-base text-slate-400 mt-2">
                Ti abbiamo inviato un'email di conferma
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <p className="text-sm text-slate-300 text-center">
                  Abbiamo inviato un'email di conferma a:
                </p>
                <p className="text-base font-semibold text-emerald-400 text-center mt-2">
                  {email}
                </p>
              </div>

              <div className="space-y-3 text-sm text-slate-300">
                <p className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">1.</span>
                  <span>Controlla la tua casella di posta (e anche la cartella spam)</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">2.</span>
                  <span>Clicca sul link di conferma nell'email</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">3.</span>
                  <span>Torna qui per accedere a Tennis Race</span>
                </p>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <p className="text-xs text-slate-400 text-center">
                  Non hai ricevuto l'email? Controlla la cartella spam o contatta{' '}
                  <a
                    href="mailto:tennisrace.app@gmail.com"
                    className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                  >
                    tennisrace.app@gmail.com
                  </a>
                </p>
              </div>
            </div>

            <Button
              onClick={() => navigate('/login')}
              className="w-full h-12 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna al Login
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

export default ConfirmEmail;
