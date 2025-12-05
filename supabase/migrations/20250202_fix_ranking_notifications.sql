-- =====================================================
-- FIX: NOTIFICHE RANKING - Notifica OGNI cambio posizione
-- =====================================================
-- Modifica il trigger per creare notifiche anche per
-- piccoli cambiamenti di posizione (1-2 posti)
-- =====================================================

CREATE OR REPLACE FUNCTION notify_ranking_change()
RETURNS TRIGGER AS $$
DECLARE
    position_diff INT;
BEGIN
    -- Solo se la posizione è cambiata
    IF OLD.live_rank_position IS DISTINCT FROM NEW.live_rank_position THEN

        position_diff := OLD.live_rank_position - NEW.live_rank_position;

        -- Se ha scalato posizioni (position_diff > 0)
        IF position_diff > 0 THEN

            -- Primo posto raggiunto
            IF NEW.live_rank_position = 1 THEN
                PERFORM create_notification(
                    NEW.user_id,
                    'ranking_first_place',
                    'Complimenti! 🎉',
                    'Hai raggiunto il primo posto in classifica!',
                    NULL,
                    'ranking',
                    'trophy'
                );

            -- Scalato 3+ posizioni
            ELSIF position_diff >= 3 THEN
                PERFORM create_notification(
                    NEW.user_id,
                    'ranking_position_change',
                    'Ottimo lavoro! 📈',
                    'Hai scalato ' || position_diff || ' posizioni! Ora sei ' || NEW.live_rank_position || '°',
                    NULL,
                    'ranking',
                    'trophy'
                );

            -- Scalato 1-2 posizioni (NUOVO!)
            ELSE
                PERFORM create_notification(
                    NEW.user_id,
                    'ranking_position_change',
                    'Posizione migliorata! 📈',
                    'Ora sei ' || NEW.live_rank_position || '° in classifica (+' || position_diff || ')',
                    NULL,
                    'ranking',
                    'trophy'
                );
            END IF;

        -- Se ha perso posizioni (position_diff < 0)
        ELSIF position_diff < 0 THEN
            -- Perso 3+ posizioni
            IF position_diff <= -3 THEN
                PERFORM create_notification(
                    NEW.user_id,
                    'ranking_position_change',
                    'Posizione in classifica',
                    'Sei sceso al ' || NEW.live_rank_position || '° posto',
                    NULL,
                    'ranking',
                    'alert-circle'
                );
            -- Perso 1-2 posizioni (NUOVO!)
            ELSE
                PERFORM create_notification(
                    NEW.user_id,
                    'ranking_position_change',
                    'Cambio in classifica',
                    'Ora sei ' || NEW.live_rank_position || '° in classifica',
                    NULL,
                    'ranking',
                    'alert-circle'
                );
            END IF;
        END IF;

    END IF;

    -- Se è cambiata la categoria
    IF OLD.live_rank_category IS DISTINCT FROM NEW.live_rank_category THEN
        PERFORM create_notification(
            NEW.user_id,
            'ranking_category_change',
            'Cambio categoria! 🏆',
            'Sei passato alla categoria ' || UPPER(NEW.live_rank_category),
            NULL,
            'ranking',
            'trophy'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Il trigger esiste già, quindi non serve ricrearlo
-- Se vuoi ricrearlo comunque:
-- DROP TRIGGER IF EXISTS trigger_notify_ranking_change ON public.players;
-- CREATE TRIGGER trigger_notify_ranking_change
--     AFTER UPDATE ON public.players
--     FOR EACH ROW
--     EXECUTE FUNCTION notify_ranking_change();

COMMENT ON FUNCTION notify_ranking_change IS 'Crea notifiche per OGNI cambio di posizione in classifica (migliorato per notificare anche piccoli cambiamenti)';
