-- Fix existing observation_flowsheets sort_order to ensure uniqueness
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) as rn
  FROM reference.observation_flowsheets
)
UPDATE reference.observation_flowsheets f
SET sort_order = numbered.rn
FROM numbered
WHERE f.id = numbered.id;

-- Fix existing observation_groups sort_order to ensure uniqueness
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) as rn
  FROM reference.observation_groups
)
UPDATE reference.observation_groups g
SET sort_order = numbered.rn
FROM numbered
WHERE g.id = numbered.id;

-- Fix existing group_parameters sort_order (partition by group)
WITH numbered AS (
  SELECT parameter_id, group_id, row_number() OVER (PARTITION BY group_id ORDER BY parameter_id) as rn
  FROM reference.group_parameters
)
UPDATE reference.group_parameters gp
SET sort_order = numbered.rn
FROM numbered
WHERE gp.parameter_id = numbered.parameter_id AND gp.group_id = numbered.group_id;

-- Add constraints
CREATE UNIQUE INDEX IF NOT EXISTS uq_flowsheets_sort_order
ON reference.observation_flowsheets (sort_order)
WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_sort_order
ON reference.observation_groups (sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_parameters_sort_order
ON reference.group_parameters (group_id, sort_order);

-- Regular indexes for fast ordering
CREATE INDEX IF NOT EXISTS idx_flowsheets_sort_order
ON reference.observation_flowsheets (sort_order);

CREATE INDEX IF NOT EXISTS idx_groups_sort_order
ON reference.observation_groups (sort_order);
