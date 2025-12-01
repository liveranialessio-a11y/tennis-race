import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  const ensurePlayerProfile = useCallback(async (user: User) => {
    try {
      setCheckingPlayerStatus(true);

      // Run queries in parallel to reduce load time
      const [playerResult, requestResult] = await Promise.allSettled([
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
      ]);

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
      console.error('Error in ensurePlayerProfile:', error);
      setHasPlayer(null);
    } finally {
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

      // Create profile if user is logged in
      if (session?.user) {
        ensurePlayerProfile(session.user);
      } else {
        setHasPlayer(null);
        setCheckingPlayerStatus(false);
      }
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Ignore SIGNED_OUT events that happen during initial load
        // This prevents the loop when an invalid token is cleared
        if (event === 'SIGNED_OUT' && !initialCheckDone) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle successful login/signup - ensure profile exists
        if (event === 'SIGNED_IN' && session?.user) {
          await ensurePlayerProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setHasPlayer(null);
          setCheckingPlayerStatus(false);
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

      // Check if email confirmation is required
      // Supabase returns email_confirmed_at as null when confirmation is required
      if (data.user && !data.user.email_confirmed_at) {
        toast({
          title: "Conferma la tua email",
          description: "Ti abbiamo inviato un'email con il link di conferma. Controlla la tua casella di posta.",
          duration: 8000,
        });
      } else {
        toast({
          title: "Registrazione completata!",
          description: "Benvenuto su Tennis Race",
        });
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
    await supabase.auth.signOut();
    toast({
      title: "Disconnesso",
      description: "Sei stato disconnesso con successo",
    });
    window.location.href = '/';
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
