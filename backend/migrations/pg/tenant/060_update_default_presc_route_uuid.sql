-- ==========================================
-- 060_update_default_presc_route_uuid.sql -- tenant
-- ==========================================

-- 1. Add the new UUID column
ALTER TABLE reference.global_products ADD COLUMN default_presc_route_uuid UUID;

-- 2. Map existing TEXT values to the matching routes.id
UPDATE reference.global_products p
SET default_presc_route_uuid = r.id
FROM reference.routes r
WHERE p.default_presc_route = r.label OR p.default_presc_route = r.code;

-- 3. Drop old TEXT column
ALTER TABLE reference.global_products DROP COLUMN default_presc_route;

-- 4. Rename new column and add FK + Index
ALTER TABLE reference.global_products RENAME COLUMN default_presc_route_uuid TO default_presc_route;

ALTER TABLE reference.global_products
    ADD CONSTRAINT fk_tenant_global_products_presc_route
    FOREIGN KEY (default_presc_route) REFERENCES reference.routes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_global_products_default_presc_route
ON reference.global_products (default_presc_route);
