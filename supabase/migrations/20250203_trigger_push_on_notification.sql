-- =====================================================
-- TRIGGER PUSH NOTIFICATIONS ON NEW NOTIFICATION
-- Date: 2025-02-03
-- =====================================================
-- Uses pg_net extension to call Edge Function asynchronously
-- =====================================================

-- Enable pg_net extension (available in all Supabase projects)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Create function to call Edge Function via pg_net
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id BIGINT;
  payload JSONB;
BEGIN
  -- Build the payload
  payload := jsonb_build_object(
    'record', jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'type', NEW.type,
      'title', NEW.title,
      'message', NEW.message,
      'created_at', NEW.created_at
    )
  );

  -- Make async HTTP request using pg_net
  SELECT net.http_post(
    url := 'https://bisbpmrrzckhdibqrsyh.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpc2JwbXJyemNraGRpYnFyc3loIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjM2ODY2OSwiZXhwIjoyMDc3OTQ0NjY5fQ.5zBvaegwUNXxVxaJnZSQpdyN82E51BlrZ1IdC20oJbk"}'::JSONB,
    body := payload
  ) INTO request_id;

  RAISE LOG 'Push notification queued with request_id: %', request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the notification insert
    RAISE WARNING 'Failed to queue push notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS on_notification_created_push ON public.notifications;

CREATE TRIGGER on_notification_created_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();

COMMENT ON FUNCTION public.trigger_push_notification() IS 'Triggers Edge Function to send push notifications via pg_net';
COMMENT ON TRIGGER on_notification_created_push ON public.notifications IS 'Automatically sends push notifications when a new notification is created';
