-- Migration 066: Fix blood bag cancellation logic
-- When a START event is cancelled (start_exists = FALSE), the bag's assigned_prescription_event_id
-- should be set back to NULL, so the bag is fully released for another prescription event.
-- We also ensure that bags marked as 'DISCARDED' are never modified.

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
    SET status = 'RECEIVED',
        assigned_prescription_event_id = NULL
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
