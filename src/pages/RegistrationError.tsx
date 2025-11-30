import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, XCircle, Phone } from 'lucide-react';

const RegistrationError: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <Card className="border border-slate-700/50 shadow-2xl bg-slate-800/90 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center pb-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                <XCircle className="h-9 w-9 text-white" strokeWidth={2} />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-white">
                Errore Registrazione
              </CardTitle>
              <CardDescription className="text-base text-slate-400 mt-2">
                Si è verificato un problema durante la creazione della tua richiesta
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm text-slate-300 text-center">
                Non è stato possibile completare la registrazione.
              </p>
              <p className="text-sm text-slate-300 text-center mt-2">
                Per risolvere il problema, contatta l'amministratore:
              </p>
            </div>

            <div className="space-y-4">
              <a
                href="tel:+393519421226"
                className="flex items-center justify-center gap-3 p-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
              >
                <Phone className="h-5 w-5 text-emerald-400" />
                <div className="text-center">
                  <p className="text-xs text-slate-400">Telefono</p>
                  <p className="text-base font-semibold text-emerald-400">351 942 1226</p>
                </div>
              </a>

              <a
                href="https://wa.me/393519421226"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 p-4 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
              >
                <svg className="h-5 w-5 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white">Contatta su WhatsApp</p>
                </div>
              </a>
            </div>

            <Button
              onClick={() => navigate('/login')}
              className="w-full h-12 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all duration-200"
            >
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

export default RegistrationError;
