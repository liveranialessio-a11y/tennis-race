import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  challengeId: string;
  type: "challenge_created" | "challenge_accepted" | "challenge_cancelled";
  challengerId?: string;
  challengedId?: string;
  notes?: string;
  acceptanceNotes?: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const { challengeId, type, challengerId, challengedId, notes, acceptanceNotes }: EmailRequest = await req.json();

    if (!challengeId || !type) {
      throw new Error("Missing required fields: challengeId and type");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Fetch profiles for emails and names
    const getProfile = async (userId?: string) => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", userId)
        .maybeSingle();
      return data as { first_name: string; last_name: string; email: string } | null;
    };

    const challenger = await getProfile(challengerId);
    const challenged = await getProfile(challengedId);

    // Compose recipients and content
    let to: string[] = [];
    let subject = "";
    let html = "";

    if (type === "challenge_created") {
      if (challenged?.email) to.push(challenged.email);
      if (challenger?.email) to.push(challenger.email); // confirmation to challenger
      subject = `Nuova sfida da ${challenger?.first_name ?? ""} ${challenger?.last_name ?? ""}`.trim();
      html = `
        <h2>Hai ricevuto una nuova sfida!</h2>
        <p>${challenger?.first_name} ${challenger?.last_name} ti ha sfidato a tennis.</p>
        ${notes ? `<p><strong>Note:</strong> ${notes}</p>` : ""}
        <p>ID sfida: <code>${challengeId}</code></p>
      `;
    }

    if (type === "challenge_accepted") {
      if (challenger?.email) to.push(challenger.email);
      if (challenged?.email) to.push(challenged.email); // confirmation to challenged
      subject = `Sfida accettata da ${challenged?.first_name ?? ""} ${challenged?.last_name ?? ""}`.trim();
      html = `
        <h2>La tua sfida è stata accettata</h2>
        <p>${challenged?.first_name} ${challenged?.last_name} ha accettato la tua sfida.</p>
        ${acceptanceNotes ? `<p><strong>Note di accettazione:</strong> ${acceptanceNotes}</p>` : ""}
        <p>ID sfida: <code>${challengeId}</code></p>
      `;
    }

    if (type === "challenge_cancelled") {
      if (challenged?.email) to.push(challenged.email);
      if (challenger?.email) to.push(challenger.email); // confirmation to challenger
      subject = `Sfida annullata`;
      html = `
        <h2>La sfida è stata annullata</h2>
        <p>La sfida con ID <code>${challengeId}</code> è stata annullata.</p>
      `;
    }

    // Fallback: avoid sending with no recipients
    to = Array.from(new Set(to.filter(Boolean)));

    if (to.length) {
      const emailResult = await resend.emails.send({
        from: "SFIDE TENNIS <onboarding@resend.dev>",
        to,
        subject,
        html,
      });
      console.log("Email sent:", emailResult);
    } else {
      console.log("No recipients for email", { type, challengeId });
    }

    // Create in-app notification as well
    const notifications: any[] = [];
    if (type === "challenge_created" && challengedId) {
      notifications.push({
        user_id: challengedId,
        title: `🎾 Nuova Sfida`,
        message: `${challenger?.first_name ?? ""} ${challenger?.last_name ?? ""} ti ha sfidato a tennis`.
          trim(),
        type: "challenge",
        related_challenge_id: challengeId,
      });
    }
    if (type === "challenge_accepted" && challengerId) {
      notifications.push({
        user_id: challengerId,
        title: `✅ Sfida Accettata`,
        message: `${challenged?.first_name ?? ""} ${challenged?.last_name ?? ""} ha accettato la tua sfida`.
          trim(),
        type: "challenge",
        related_challenge_id: challengeId,
      });
    }
    if (type === "challenge_cancelled" && challengedId) {
      notifications.push({
        user_id: challengedId,
        title: `❌ Sfida Annullata`,
        message: `La sfida è stata annullata`,
        type: "challenge",
        related_challenge_id: challengeId,
      });
    }

    if (notifications.length) {
      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) console.error("Failed to insert notifications:", error.message);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-challenge-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});