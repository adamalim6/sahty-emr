-- Migration 117: Seed default PHARMACY locations if none exist
-- Every pharmacy needs at least one physical location to receive stock into.

INSERT INTO locations (location_id, tenant_id, name, type, scope, location_class, valuation_policy, status)
SELECT gen_random_uuid(), tenant_id, 'Stock Central Pharmacie', 'PHYSICAL', 'PHARMACY', 'COMMERCIAL', 'VALUABLE', 'ACTIVE'
FROM (SELECT DISTINCT tenant_id FROM locations) AS tenants
WHERE NOT EXISTS (
    SELECT 1 FROM locations l2
    WHERE l2.tenant_id = tenants.tenant_id
      AND l2.scope = 'PHARMACY'
      AND l2.type = 'PHYSICAL'
      AND l2.status = 'ACTIVE'
);
