import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  hasPlayer: boolean | null;
  checkingPlayerStatus: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string, phone: string, avatarFile: File | null) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPlayer, setHasPlayer] = useState<boolean | null>(null);
  const [checkingPlayerStatus, setCheckingPlayerStatus] = useState(false);
  const { toast } = useToast();
  const isCheckingRef = useRef(false);
  const profileCheckScheduledRef = useRef(false);

  const ensurePlayerProfile = useCallback(async (user: User) => {
    // Prevent multiple simultaneous calls
    if (isCheckingRef.current) {
      return;
    }

    try {
      isCheckingRef.current = true;
      setCheckingPlayerStatus(true);

      const startTime = performance.now();

      // Use a short timeout (3s) and allow app to load anyway if it times out
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout after 3 seconds')), 3000)
      );

      // Run queries in parallel with timeout
      const queryStart = performance.now();

      const [playerResult, requestResult] = await Promise.race([
        Promise.allSettled([
          supabase
            .from('players')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('registration_requests' as any)
            .select('id, status')
            .eq('user_id', user.id)
            .maybeSingle()
        ]),
        timeoutPromise
      ]) as any;

      const queryTime = performance.now() - queryStart;

      // Check player result
      if (playerResult.status === 'fulfilled' && playerResult.value.data) {
        setHasPlayer(true);
        setCheckingPlayerStatus(false);
        return;
      }

      // Check registration request result
      if (requestResult.status === 'fulfilled' && requestResult.value.data) {
        setHasPlayer(false);
        setCheckingPlayerStatus(false);
        return;
      }

      // Only create registration if both checks failed and it's needed
      // Get default championship ID
      const { data: defaultChampId, error: champError } = await supabase.rpc('get_default_championship_id' as any);

      if (champError || !defaultChampId) {
        console.error('❌ No default championship found', champError);
        setHasPlayer(null);
        setCheckingPlayerStatus(false);
        return;
      }

      // Get display name from metadata
      const firstName = user.user_metadata?.first_name || '';
      const lastName = user.user_metadata?.last_name || '';
      const phone = user.user_metadata?.phone || '';
      const displayName = `${firstName} ${lastName}`.trim() || user.email?.split('@')[0] || 'Giocatore';

      // Create registration request
      const { error: insertError } = await supabase
        .from('registration_requests' as any)
        .insert({
          user_id: user.id,
          championship_id: defaultChampId,
          display_name: displayName,
          phone: phone || null,
          status: 'pending'
        });

      if (insertError) {
        // If error is 409 (conflict), it means the registration request already exists
        if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
          setHasPlayer(false);
        } else {
          console.error('Error creating registration request:', insertError);
          setHasPlayer(null);
        }
      } else {
        setHasPlayer(false);
      }

    } catch (error: any) {
      // If timeout occurs, allow access - assume user has player profile
      if (error.message?.includes('timeout')) {
        setHasPlayer(true);
      } else {
        setHasPlayer(null);
      }
    } finally {
      isCheckingRef.current = false;
      setCheckingPlayerStatus(false);
    }
  }, []);

  useEffect(() => {
    let initialCheckDone = false;

    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      // If there's an error with the session, clear it
      if (error) {
        supabase.auth.signOut();
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      initialCheckDone = true;

      // DON'T check profile here - wait for onAuthStateChange INITIAL_SESSION
      // This prevents the race condition with session refresh
      if (!session?.user) {
        setHasPlayer(null);
        setCheckingPlayerStatus(false);
      }
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state changed:', event, session ? 'Has session' : 'No session');

        // Ignore SIGNED_OUT events that happen during initial load
        // This prevents the loop when an invalid token is cleared
        if (event === 'SIGNED_OUT' && !initialCheckDone) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Only check profile on INITIAL_SESSION or TOKEN_REFRESHED
        // IMPORTANT: Skip SIGNED_IN completely - it fires before session is stable
        // and causes timeouts. INITIAL_SESSION fires after and has stable session.
        if (session?.user && !profileCheckScheduledRef.current) {
          if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            profileCheckScheduledRef.current = true;
            await ensurePlayerProfile(session.user);
          }
        } else if (!session?.user) {
          setHasPlayer(null);
          setCheckingPlayerStatus(false);
          profileCheckScheduledRef.current = false;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [ensurePlayerProfile]);

  const uploadAvatar = async (userId: string, avatarFile: File): Promise<string | null> => {
    try {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('❌ Avatar upload error:', uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('❌ Error uploading avatar:', error);
      return null;
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, phone: string, avatarFile: File | null) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone,
        },
        emailRedirectTo: window.location.origin,
      }
    });

    if (error) {
      console.error('❌ Signup error:', error);
      toast({
        title: "Errore registrazione",
        description: error.message,
        variant: "destructive",
      });
    } else if (data?.user) {
      // Note: Avatar upload is disabled during signup due to RLS policies
      // Users can upload their avatar from the Profile page after login
      // Note: Player profile is created by admin when approving registration request

      // Create registration request
      try {
        // Get default championship ID
        const { data: championshipData, error: champError } = await supabase
          .rpc('get_default_championship_id');

        if (champError) {
          console.error('❌ Error getting default championship:', champError);
          toast({
            title: "Errore",
            description: "Impossibile ottenere il campionato predefinito",
            variant: "destructive",
          });
          return { error: champError };
        }

        if (!championshipData) {
          console.error('❌ No default championship found');
          toast({
            title: "Errore",
            description: "Nessun campionato predefinito trovato",
            variant: "destructive",
          });
          return { error: new Error('No default championship') as any };
        }

        // Create registration request
        const displayName = `${firstName} ${lastName}`;
        const { error: requestError } = await supabase
          .from('registration_requests')
          .insert({
            user_id: data.user.id,
            championship_id: championshipData,
            display_name: displayName,
            phone: phone,
            status: 'pending'
          });

        if (requestError) {
          console.error('❌ Error creating registration request:', requestError);
          toast({
            title: "Errore",
            description: "Impossibile creare la richiesta di registrazione",
            variant: "destructive",
          });
          return { error: requestError };
        }

        toast({
          title: "Registrazione completata!",
          description: "La tua richiesta è stata inviata. Attendi l'approvazione dell'amministratore.",
        });
      } catch (err) {
        console.error('❌ Error in registration request creation:', err);
        toast({
          title: "Errore",
          description: "Si è verificato un errore durante la registrazione",
          variant: "destructive",
        });
        return { error: err as any };
      }
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Login error:', error);
      toast({
        title: "Errore accesso",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Benvenuto!",
        description: "Accesso effettuato con successo",
      });
    }

    return { error };
  };

  const signOut = async () => {
    // Clear all auth state first
    setUser(null);
    setSession(null);
    setHasPlayer(null);

    try {
      // Clear ALL possible auth storage keys
      const keysToRemove = Object.keys(localStorage).filter(key =>
        key.includes('supabase') || key.includes('auth')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
      sessionStorage.clear();

      // Try to sign out from Supabase
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});

      toast({
        title: "Disconnesso",
        description: "Sei stato disconnesso con successo",
      });
    } catch (err) {
      // Silent error handling
    } finally {
      // Use window.location.replace instead of href to prevent back button
      window.location.replace('/');
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error('❌ Password reset error:', error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email inviata!",
        description: "Controlla la tua casella di posta per reimpostare la password",
        duration: 8000,
      });
    }

    return { error };
  };

  const value = {
    user,
    session,
    loading,
    hasPlayer,
    checkingPlayerStatus,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
