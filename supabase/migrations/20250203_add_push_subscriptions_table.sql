-- =====================================================
-- CREATE PUSH SUBSCRIPTIONS TABLE
-- Date: 2025-02-03
-- =====================================================
-- Tabella per salvare i token di subscription per le push notifications
-- =====================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, endpoint)
);

-- Index per query veloci
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- Trigger per aggiornare updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.push_subscriptions IS 'Stores push notification subscription tokens for web push';
COMMENT ON COLUMN public.push_subscriptions.endpoint IS 'Push service endpoint URL';
COMMENT ON COLUMN public.push_subscriptions.p256dh IS 'Public key for encryption';
COMMENT ON COLUMN public.push_subscriptions.auth IS 'Auth secret for encryption';
COMMENT ON COLUMN public.push_subscriptions.user_agent IS 'Browser user agent string';
COMMENT ON COLUMN public.push_subscriptions.last_used_at IS 'Last time a notification was sent to this subscription';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
