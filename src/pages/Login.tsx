import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trophy, Eye, EyeOff, Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TennisLoadingAnimation from '@/components/TennisLoadingAnimation';

const Login: React.FC = () => {
  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();

  // View state
  const [view, setView] = useState<'landing' | 'login' | 'register'>('landing');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Password reset state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Register state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [phonePrefix, setPhonePrefix] = useState('+39');
  const [phone, setPhone] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  React.useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Show loading animation when logging in or registering
  if (isLoggingIn) {
    return <TennisLoadingAnimation text="Accesso in corso..." />;
  }

  if (isRegistering) {
    return <TennisLoadingAnimation text="Registrazione in corso..." />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      return;
    }

    setIsLoggingIn(true);

    const { error } = await signIn(loginEmail, loginPassword);
    
    setIsLoggingIn(false);
    
    if (!error) {
      navigate('/');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!registerEmail || !registerPassword || !firstName || !lastName || !phone) {
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      return;
    }

    if (registerPassword.length < 6) {
      return;
    }

    // Validate phone number length (Italian mobile: 10 digits)
    if (phone.replace(/\D/g, '').length !== 10) {
      return;
    }

    setIsRegistering(true);

    // Combine prefix and phone number
    const fullPhone = phonePrefix + phone;

    const { error } = await signUp(registerEmail, registerPassword, firstName, lastName, fullPhone, avatarFile);

    setIsRegistering(false);

    if (!error) {
      // Redirect to email confirmation page
      navigate(`/confirm-email?email=${encodeURIComponent(registerEmail)}`);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetEmail) {
      return;
    }

    setIsResetting(true);

    const { error } = await resetPassword(resetEmail);

    setIsResetting(false);

    if (!error) {
      setShowResetDialog(false);
      setResetEmail('');
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  // Landing Page View
  if (view === 'landing') {
    return (
      <div className="min-h-screen flex flex-col relative overflow-hidden bg-slate-900">
        {/* Tennis Court Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/image.png)',
            filter: 'brightness(0.4)'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative z-10">
          <div className="text-center space-y-10 max-w-4xl">
            {/* Logo/Icon */}
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-2xl shadow-emerald-500/20">
              <Trophy className="w-16 h-16 text-white" strokeWidth={2} />
            </div>

            {/* App Title */}
            <div className="space-y-4">
              <h1 className="text-6xl md:text-8xl font-extrabold text-white tracking-tight">
                TENNIS RACE
              </h1>
              <p className="text-xl md:text-2xl text-slate-200 font-light max-w-2xl mx-auto leading-relaxed">
                La piattaforma per gestire il campionato di tennis
              </p>
            </div>

            {/* Description */}
            <p className="text-base md:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
              Organizza sfide, monitora le classifiche in tempo reale e tieni traccia
              delle tue statistiche
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button
                size="lg"
                className="h-14 px-10 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-200"
                onClick={() => setView('register')}
              >
                Inizia Ora
              </Button>
              <Button
                size="lg"
                className="h-14 px-10 text-base font-semibold border-2 border-white bg-white/10 text-white hover:bg-white hover:text-slate-900 rounded-lg backdrop-blur-md transition-all duration-200"
                onClick={() => setView('login')}
              >
                Ho già un account
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="w-full text-center py-8 space-y-2 text-sm text-slate-400 relative z-10 border-t border-white/10">
          <p>Tennis Race © 2025</p>
          <p className="text-xs">
            Vuoi questa app per la tua città?{' '}
            <a
              href="mailto:tennisrace.app@gmail.com"
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4 transition-colors"
            >
              tennisrace.app@gmail.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Login View
  if (view === 'login') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-900">
        {/* Tennis Court Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/image.png)',
            filter: 'brightness(0.3)'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />

        <div className="w-full max-w-md relative z-10">
          <Card className="border border-slate-700/50 shadow-2xl bg-slate-800/90 backdrop-blur-xl">
            <CardHeader className="space-y-4 text-center pb-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Trophy className="h-9 w-9 text-white" strokeWidth={2} />
                </div>
              </div>
              <div>
                <CardTitle className="text-3xl font-bold text-white">
                  Accedi
                </CardTitle>
                <CardDescription className="text-base text-slate-400 mt-2">
                  Benvenuto in Tennis Race
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4" key="login-form">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-slate-200">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="tua@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    disabled={isLoggingIn}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-slate-200">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowResetDialog(true)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      Password dimenticata?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={isLoggingIn}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/30 transition-all duration-200"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? 'Accesso...' : 'Accedi'}
                </Button>

                <div className="text-center pt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setView('landing')}
                    className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    ← Torna indietro
                  </button>
                  <p className="text-sm text-slate-400">
                    Non hai un account?{' '}
                    <button
                      type="button"
                      onClick={() => setView('register')}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                    >
                      Registrati
                    </button>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-8 text-xs text-slate-500">
            <p>
              Vuoi questa app per la tua città?{' '}
              <a
                href="mailto:tennisrace.app@gmail.com"
                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4 transition-colors"
              >
                tennisrace.app@gmail.com
              </a>
            </p>
          </div>
        </div>

        {/* Password Reset Dialog */}
        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Reimposta Password</DialogTitle>
              <DialogDescription className="text-slate-400">
                Inserisci la tua email e ti invieremo un link per reimpostare la password
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-slate-200">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="tua@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  disabled={isResetting}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResetDialog(false)}
                  disabled={isResetting}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={isResetting || !resetEmail}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  {isResetting ? 'Invio...' : 'Invia Link'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Register View
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-900">
      {/* Tennis Court Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url(/image.png)',
          filter: 'brightness(0.3)'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />

      <div className="w-full max-w-md relative z-10">
        <Card className="border border-slate-700/50 shadow-2xl bg-slate-800/90 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center pb-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Trophy className="h-9 w-9 text-white" strokeWidth={2} />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-white">
                Registrati
              </CardTitle>
              <CardDescription className="text-base text-slate-400 mt-2">
                Unisciti a Tennis Race
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4" key="register-form">
              <div className="flex justify-center">
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <Avatar className="h-24 w-24 border-2 border-dashed border-muted-foreground hover:border-tennis-court transition-colors">
                    <AvatarImage src={avatarPreview || undefined} alt="Avatar" />
                    <AvatarFallback className="bg-muted/50">
                      <Camera className="h-8 w-8 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                </Label>
                <Input
                  id="avatar-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={isRegistering}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Immagine profilo (facoltativa)
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name" className="text-slate-200">Nome</Label>
                  <Input
                    id="first-name"
                    type="text"
                    placeholder="Mario"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={isRegistering}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name" className="text-slate-200">Cognome</Label>
                  <Input
                    id="last-name"
                    type="text"
                    placeholder="Rossi"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={isRegistering}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email" className="text-slate-200">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="tua@email.com"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                  disabled={isRegistering}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-200">Numero di Telefono</Label>
                <div className="flex gap-2">
                  <Input
                    id="phone-prefix"
                    type="text"
                    value={phonePrefix}
                    onChange={(e) => setPhonePrefix(e.target.value)}
                    className="w-20"
                    disabled={isRegistering}
                  />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="3331234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={isRegistering}
                    className="flex-1"
                    minLength={10}
                    maxLength={10}
                    pattern="[0-9]{10}"
                  />
                </div>
                {phone && phone.replace(/\D/g, '').length !== 10 && (
                  <p className="text-xs text-red-600">
                    Il numero deve essere di 10 cifre
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password" className="text-slate-200">Password</Label>
                <div className="relative">
                  <Input
                    id="register-password"
                    type={showRegisterPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={isRegistering}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showRegisterPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimo 6 caratteri
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-slate-200">Conferma Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  required
                  disabled={isRegistering}
                />
                {registerPassword && registerConfirmPassword && registerPassword !== registerConfirmPassword && (
                  <p className="text-xs text-red-600">
                    Le password non coincidono
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/30 transition-all duration-200"
                disabled={
                  isRegistering ||
                  !registerEmail ||
                  !registerPassword ||
                  !firstName ||
                  !lastName ||
                  !phone ||
                  phone.replace(/\D/g, '').length !== 10 ||
                  registerPassword !== registerConfirmPassword ||
                  registerPassword.length < 6
                }
              >
                {isRegistering ? 'Registrazione...' : 'Registrati'}
              </Button>

              <div className="text-center pt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setView('landing')}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Torna indietro
                </button>
                <p className="text-sm text-slate-400">
                  Hai già un account?{' '}
                  <button
                    type="button"
                    onClick={() => setView('login')}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                  >
                    Accedi
                  </button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Reimposta Password</DialogTitle>
          <DialogDescription className="text-slate-400">
            Inserisci la tua email e ti invieremo un link per reimpostare la password
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email" className="text-slate-200">Email</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="tua@email.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              disabled={isResetting}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={isResetting}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={isResetting || !resetEmail}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {isResetting ? 'Invio...' : 'Invia Link'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </div>
  );
};

export default Login;
