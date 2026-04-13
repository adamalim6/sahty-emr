-- Migration 118: Seed QUARANTINE_DELIVERY system location for incoming delivery stock processing.
-- This is distinct from RETURN_QUARANTINE (which handles return workflows).
-- QUARANTINE_DELIVERY holds stock temporarily during delivery processing before injection.

INSERT INTO locations (location_id, tenant_id, name, type, scope, location_class, valuation_policy, status)
SELECT gen_random_uuid(), tenant_id, 'QUARANTINE_DELIVERY', 'VIRTUAL', 'SYSTEM', 'COMMERCIAL', 'VALUABLE', 'ACTIVE'
FROM (SELECT DISTINCT tenant_id FROM locations) AS tenants
WHERE NOT EXISTS (
    SELECT 1 FROM locations l2
    WHERE l2.tenant_id = tenants.tenant_id
      AND l2.name = 'QUARANTINE_DELIVERY'
      AND l2.scope = 'SYSTEM'
);
