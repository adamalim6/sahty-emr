-- ============================================================================
-- Migration 054: Enforce Performer Identity on Administration Events
-- ============================================================================

-- 1. Truncate prototype administration events (Authorized by User for prototype phase)
TRUNCATE TABLE administration_events CASCADE;

-- 2. Enforce strict NOT NULL for derived backend identity
ALTER TABLE administration_events
ALTER COLUMN performed_by_user_id SET NOT NULL;

-- 3. Ensure the performer is a valid user
ALTER TABLE administration_events
ADD CONSTRAINT fk_admin_event_user
FOREIGN KEY (performed_by_user_id)
REFERENCES auth.users(user_id)
ON DELETE RESTRICT;

-- 4. Clean up the deprecated text field which can be spoofed or unsynced
ALTER TABLE administration_events
DROP COLUMN IF EXISTS performed_by;
