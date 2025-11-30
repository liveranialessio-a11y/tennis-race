import { supabase } from '@/integrations/supabase/client';

export interface ChallengeEmailData {
  to: string;
  recipientName: string;
  senderName: string;
  challengeType: 'launched' | 'accepted' | 'scheduled' | 'reminder' | 'deleted';
  matchDate?: string;
  matchTime?: string;
  matchId?: string;
}

// Funzione per loggare errori nel database
const logEmailError = async (data: ChallengeEmailData, errorMessage: string) => {
  try {
    await supabase.from('email_errors').insert({
      match_id: data.matchId || null,
      recipient_email: data.to,
      recipient_name: data.recipientName,
      sender_name: data.senderName,
      challenge_type: data.challengeType,
      error_message: errorMessage,
    });
  } catch (logError) {
    console.error('❌ Errore nel logging dell\'errore email:', logError);
  }
};

// Funzione principale per inviare email tramite Edge Function
export const sendChallengeEmail = async (data: ChallengeEmailData): Promise<boolean> => {
  try {
    const { data: result, error } = await supabase.functions.invoke('send-email', {
      body: data,
    });

    if (error) {
      console.error('❌ Errore invio email:', error);
      await logEmailError(data, error.message || 'Errore sconosciuto');
      return false;
    }

    if (result?.success) {
      console.log(`✅ Email inviata con successo a ${data.to}`);
      return true;
    } else {
      const errorMsg = result?.error || 'Errore sconosciuto';
      console.error('❌ Errore invio email:', errorMsg);
      await logEmailError(data, errorMsg);
      return false;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Errore sconosciuto';
    console.error('❌ Errore invio email:', errorMsg);
    await logEmailError(data, errorMsg);
    return false;
  }
};

// Funzione helper per formattare la data in italiano
export const formatDateForEmail = (date: Date): string => {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

// Funzione helper per formattare l'orario
export const formatTimeForEmail = (date: Date): string => {
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};
