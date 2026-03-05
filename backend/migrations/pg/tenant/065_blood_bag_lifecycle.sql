-- PART 2: Schema Update
ALTER TABLE public.transfusion_blood_bags
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'RECEIVED';

ALTER TABLE public.transfusion_blood_bags
ADD COLUMN IF NOT EXISTS assigned_prescription_event_id UUID NULL;

-- PART 5: Blood Bag Status Recompute Function
CREATE OR REPLACE FUNCTION public.recompute_blood_bag_status(p_bag_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    start_exists BOOLEAN;
    end_exists BOOLEAN;
BEGIN

IF (SELECT status FROM public.transfusion_blood_bags WHERE id = p_bag_id) = 'DISCARDED' THEN
    RETURN;
END IF;

SELECT EXISTS (
    SELECT 1
    FROM public.administration_events ae
    JOIN public.administration_event_blood_bags aebb
        ON ae.id = aebb.administration_event_id
    WHERE aebb.blood_bag_id = p_bag_id
    AND ae.status = 'ACTIVE'
    AND ae.action_type = 'started'
) INTO start_exists;

SELECT EXISTS (
    SELECT 1
    FROM public.administration_events ae
    JOIN public.administration_event_blood_bags aebb
        ON ae.id = aebb.administration_event_id
    WHERE aebb.blood_bag_id = p_bag_id
    AND ae.status = 'ACTIVE'
    AND ae.action_type = 'ended'
) INTO end_exists;

IF start_exists = FALSE THEN
    UPDATE public.transfusion_blood_bags
    SET status = 'RECEIVED'
    WHERE id = p_bag_id;

ELSIF start_exists = TRUE AND end_exists = FALSE THEN
    UPDATE public.transfusion_blood_bags
    SET status = 'IN_USE'
    WHERE id = p_bag_id;

ELSIF start_exists = TRUE AND end_exists = TRUE THEN
    UPDATE public.transfusion_blood_bags
    SET status = 'USED'
    WHERE id = p_bag_id;

END IF;

END;
$$;

-- PART 6: Trigger to Maintain Bag State
CREATE OR REPLACE FUNCTION public.trigger_recompute_bag_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    bag_id UUID;
    v_event_id UUID;
BEGIN

-- Determine the event_id depending on operation
IF TG_OP = 'DELETE' THEN
    v_event_id := OLD.id;
ELSE
    v_event_id := NEW.id;
END IF;

FOR bag_id IN
    SELECT blood_bag_id
    FROM public.administration_event_blood_bags
    WHERE administration_event_id = v_event_id
LOOP
    PERFORM public.recompute_blood_bag_status(bag_id);
END LOOP;

IF TG_OP = 'DELETE' THEN
    RETURN OLD;
ELSE
    RETURN NEW;
END IF;

END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_bag_status ON public.administration_events;
CREATE TRIGGER trg_recompute_bag_status
AFTER INSERT OR UPDATE OF status OR DELETE
ON public.administration_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recompute_bag_status();

-- Also trigger when a bag is directly linked or unlinked from an event
CREATE OR REPLACE FUNCTION public.trigger_recompute_bag_status_assoc()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.recompute_blood_bag_status(OLD.blood_bag_id);
        RETURN OLD;
    ELSE
        PERFORM public.recompute_blood_bag_status(NEW.blood_bag_id);
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_bag_status_assoc ON public.administration_event_blood_bags;
CREATE TRIGGER trg_recompute_bag_status_assoc
AFTER INSERT OR UPDATE OR DELETE
ON public.administration_event_blood_bags
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recompute_bag_status_assoc();

-- PART 11: Performance Indexes
CREATE INDEX IF NOT EXISTS idx_aebb_blood_bag
ON public.administration_event_blood_bags (blood_bag_id);

CREATE INDEX IF NOT EXISTS idx_admin_event_status
ON public.administration_events (status);

CREATE INDEX IF NOT EXISTS idx_admin_event_action
ON public.administration_events (action_type);
