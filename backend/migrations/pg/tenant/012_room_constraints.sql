-- 012: Room constraints + drop beds.is_active
-- 1. Unique active room constraint (service + type + name)
-- 2. Add INACTIVE to bed_status enum
-- 3. Drop is_active from beds (use status = 'INACTIVE' instead)

-- Step 1: Clean up any duplicate active rooms (keep the first one)
DELETE FROM beds WHERE room_id IN (
    SELECT id FROM rooms WHERE id NOT IN (
        SELECT DISTINCT ON (service_id, room_type_id, name) id
        FROM rooms WHERE is_active = true
        ORDER BY service_id, room_type_id, name, id
    ) AND is_active = true
);
DELETE FROM rooms
WHERE id NOT IN (
    SELECT DISTINCT ON (service_id, room_type_id, name) id
    FROM rooms WHERE is_active = true
    ORDER BY service_id, room_type_id, name, id
) AND is_active = true;

-- Step 2: Unique partial index — only active rooms
CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_service_type_name_active
ON rooms (service_id, room_type_id, name)
WHERE is_active = true;

-- Step 3: Add INACTIVE value to bed_status enum
ALTER TYPE bed_status ADD VALUE IF NOT EXISTS 'INACTIVE';

-- Step 4: (must be in separate txn after enum commit)
-- Migrate beds.is_active = false → status = 'INACTIVE'
UPDATE beds SET status = 'INACTIVE' WHERE is_active = false AND status != 'INACTIVE';

-- Step 5: Drop is_active from beds
ALTER TABLE beds DROP COLUMN IF EXISTS is_active;
