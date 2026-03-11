-- 077_add_author_names_observations.sql

BEGIN;

ALTER TABLE patient_observations
ADD COLUMN author_first_name TEXT NULL,
ADD COLUMN author_last_name TEXT NULL;

-- In case there's old records missing data, populate them from auth.users
UPDATE patient_observations po
SET 
  author_first_name = u.first_name,
  author_last_name = u.last_name
FROM auth.users u
WHERE po.created_by = u.user_id
  AND (po.author_first_name IS NULL OR po.author_last_name IS NULL);

-- Make them mandatory for future
ALTER TABLE patient_observations
ALTER COLUMN author_first_name SET NOT NULL,
ALTER COLUMN author_last_name SET NOT NULL;

COMMIT;
