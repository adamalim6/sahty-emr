# SQLite to PostgreSQL Migration Runbook

## Prerequisites

1. **Docker Desktop** running with PostgreSQL container
2. **Node.js 18+** with npm
3. **Backend dependencies** installed: `cd backend && npm install`

## Quick Start

```bash
# Full migration (recommended)
cd backend
npx ts-node ../scripts/migrate/99_migrate_all.ts
```

---

## Step-by-Step Migration

### 1. Start PostgreSQL

```bash
# From project root
docker compose up -d

# Verify running
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Expected output:

```
NAMES            STATUS
sahty_pgadmin    Up ...
sahty_postgres   Up ... (healthy)
```

### 2. Audit Source Databases (Optional but Recommended)

```bash
cd backend

# Audit global database
npx ts-node ../scripts/migrate/00_audit_sqlite_global.ts

# Audit all tenant databases
npx ts-node ../scripts/migrate/10_audit_sqlite_tenant.ts
```

Review any issues in:

- `backend/data/audit_global_report.json`
- `backend/data/audit_tenants_report.json`

### 3. Migrate Global Database

```bash
npx ts-node ../scripts/migrate/01_migrate_global.ts
```

### 4. Migrate Each Tenant

```bash
# Migrate specific tenant
npx ts-node ../scripts/migrate/11_migrate_tenant.ts 1768230020156

# Or migrate all tenants
npx ts-node ../scripts/migrate/99_migrate_all.ts
```

### 5. Verify Migration

```bash
# Row count comparison
npx ts-node ../scripts/verify/compare_counts.ts

# Inventory reconciliation
npx ts-node ../scripts/verify/inventory_reconcile.ts
```

### 6. Update Environment

Copy `.env.example` and configure:

```bash
cp .env.example .env
```

Key settings:

```env
PG_HOST=localhost
PG_PORT=5432
PG_USER=sahty
PG_PASSWORD=sahty_dev_2026
PG_GLOBAL_DB=sahty_global
PG_TENANT_DB_PREFIX=tenant_
```

### 7. Start Backend

```bash
cd backend
npm run dev
```

---

## Verification Checklist

- [ ] Global database created: `sahty_global`
- [ ] Tenant databases created: `tenant_{id}`
- [ ] Row counts match between SQLite and PostgreSQL
- [ ] No negative stock values
- [ ] No orphan records
- [ ] Inventory movements sum to current stock
- [ ] Application starts without errors
- [ ] Login works
- [ ] Pharmacy operations work

---

## Troubleshooting

### Database already exists

The scripts use `ON CONFLICT DO NOTHING` for idempotency. Safe to rerun.

### FK constraint violations

Run audit scripts first. Orphan records are quarantined to `_migration_issues` table.

### Connection refused

Ensure Docker is running: `docker compose up -d`

### Type errors

Boolean columns migrated from `0/1` to `TRUE/FALSE`. Check query syntax.

---

## Rollback

To start fresh:

```bash
# Drop all databases
docker exec sahty_postgres psql -U sahty -d sahty_emr -c "DROP DATABASE IF EXISTS sahty_global;"
docker exec sahty_postgres psql -U sahty -d sahty_emr -c "DROP DATABASE IF EXISTS tenant_1768230020156;"
# Repeat for other tenants...

# Or full reset
docker compose down -v
docker compose up -d
```

---

## pgAdmin Access

- URL: http://localhost:5050
- Email: admin@sahty.dev
- Password: admin123

Add server connection:

- Host: postgres (or sahty_postgres)
- Port: 5432
- Username: sahty
- Password: sahty_dev_2026
