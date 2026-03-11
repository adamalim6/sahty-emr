-- 072_cleanup_surveillance_triggers.sql
-- Removes duplicate triggers and functions leftover from previous surveillance iterations
-- to prevent redundant execution and schema mismatch crashes.

-- Drop any lingering duplicate trigger attached to surveillance_values_events
DROP TRIGGER IF EXISTS trg_surv_event_bucket ON surveillance_values_events;
DROP TRIGGER IF EXISTS trg_surveillance_event_bucket ON surveillance_values_events;

-- Re-establish the single, canonical trigger linking to our corrected function from 071
CREATE TRIGGER trg_surveillance_event_bucket
AFTER INSERT ON surveillance_values_events
FOR EACH ROW
EXECUTE FUNCTION update_surveillance_hour_bucket();
