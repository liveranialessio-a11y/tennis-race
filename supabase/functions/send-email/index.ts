import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string;
  recipientName: string;
  senderName: string;
  challengeType: 'launched' | 'accepted' | 'scheduled' | 'reminder' | 'deleted';
  matchDate?: string;
  matchTime?: string;
}

const getEmailTemplate = (data: EmailRequest): { subject: string; html: string } => {
  const { recipientName, senderName, challengeType, matchDate, matchTime } = data;

  const baseStyle = `
    font-family: Arial, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    background-color: #f9fafb;
    padding: 20px;
  `;

  const cardStyle = `
    background: white;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  `;

  let subject = '';
  let title = '';
  let message = '';

  switch (challengeType) {
    case 'launched':
      subject = `🎾 ${senderName} ti ha lanciato una sfida!`;
      title = '🎾 Nuova Sfida Ricevuta!';
      message = `
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Ciao <strong>${recipientName}</strong>,
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          <strong>${senderName}</strong> ti ha lanciato una sfida su <strong>Tennis Race</strong>!
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Accedi all'app per accettare o rifiutare la sfida.
        </p>
      `;
      break;

    case 'accepted':
      subject = `✅ ${senderName} ha accettato la tua sfida!`;
      title = '✅ Sfida Accettata!';
      message = `
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Ciao <strong>${recipientName}</strong>,
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          <strong>${senderName}</strong> ha accettato la tua sfida!
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Ora potete mettervi d'accordo su data e orario direttamente nell'app.
        </p>
      `;
      break;

    case 'scheduled':
      subject = `📅 Sfida programmata con ${senderName}`;
      title = '📅 Sfida Programmata!';
      message = `
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Ciao <strong>${recipientName}</strong>,
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          La tua sfida con <strong>${senderName}</strong> è stata programmata!
        </p>
        <div style="background-color: #8BC34A20; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; color: #8BC34A; font-weight: bold; margin: 0;">
            📅 ${matchDate}
          </p>
          <p style="font-size: 18px; color: #8BC34A; font-weight: bold; margin: 8px 0 0 0;">
            🕐 ${matchTime}
          </p>
        </div>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Ci vediamo sul campo! 🎾
        </p>
      `;
      break;

    case 'reminder':
      subject = `⏰ Promemoria: Partita domani con ${senderName}`;
      title = '⏰ Promemoria Partita';
      message = `
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Ciao <strong>${recipientName}</strong>,
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Ti ricordiamo che domani hai una partita programmata con <strong>${senderName}</strong>!
        </p>
        <div style="background-color: #FFA72620; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; color: #FF9800; font-weight: bold; margin: 0;">
            📅 ${matchDate}
          </p>
          <p style="font-size: 18px; color: #FF9800; font-weight: bold; margin: 8px 0 0 0;">
            🕐 ${matchTime}
          </p>
        </div>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Preparati per la sfida! 🎾
        </p>
      `;
      break;

    case 'deleted':
      subject = `❌ ${senderName} ha eliminato la sfida`;
      title = '❌ Sfida Eliminata';
      message = `
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Ciao <strong>${recipientName}</strong>,
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          <strong>${senderName}</strong> ha eliminato la vostra sfida programmata.
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Se vuoi, puoi lanciare una nuova sfida dall'app! 🎾
        </p>
      `;
      break;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="${baseStyle}">
        <div style="${cardStyle}">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #8BC34A; margin: 0; font-size: 28px;">TENNIS RACE</h1>
            <p style="color: #6B7280; margin: 5px 0 0 0;">Torneo di Tennis</p>
          </div>
          <h2 style="color: #1F2937; font-size: 24px; margin-bottom: 20px;">${title}</h2>
          ${message}
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center;">
            <p style="color: #9CA3AF; font-size: 14px; margin: 0;">Tennis Race - Torneo di Tennis</p>
            <p style="color: #9CA3AF; font-size: 12px; margin: 10px 0 0 0;">
              Questa è una notifica automatica, non rispondere a questa email
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const emailData: EmailRequest = await req.json()
    const { subject, html } = getEmailTemplate(emailData)

    // Usa Brevo API (ex Sendinblue) - 300 email/giorno GRATIS
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
    const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'noreply@tennisrace.com'
    const SENDER_NAME = Deno.env.get('SENDER_NAME') || 'Tennis Race'

    if (!BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY not configured')
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: [
          {
            email: emailData.to,
            name: emailData.recipientName,
          },
        ],
        subject: subject,
        htmlContent: html,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Brevo API error:', result)
      throw new Error(result.message || 'Errore invio email')
    }

    console.log(`✅ Email inviata con successo a ${emailData.to}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Email inviata con successo', messageId: result.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
