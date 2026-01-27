# PostgreSQL Cutover Runbook

## Pre-Cutover Checklist

- [ ] Docker PostgreSQL container running and healthy
- [ ] All migration scripts executed successfully
- [ ] Row count verification passed (`compare_counts.ts`)
- [ ] Inventory reconciliation passed (`inventory_reconcile.ts`)
- [ ] Concurrency simulation passed (`concurrency_sim.ts`)
- [ ] Backend `.env` updated with PostgreSQL settings
- [ ] Backup of SQLite databases taken

---

## Cutover Steps

### 1. Maintenance Window (Recommended)

```bash
# Stop frontend/backend
pm2 stop sahty-backend  # or equivalent
```

### 2. Final Data Sync

```bash
cd backend
npx ts-node ../scripts/migrate/99_migrate_all.ts
```

### 3. Environment Configuration

```bash
# Copy and configure .env
cp .env.example .env

# Verify settings
cat .env | grep PG_
```

### 4. Start Backend

```bash
cd backend
npm run dev  # or npm run build && npm start
```

### 5. Smoke Test

- [ ] Login works
- [ ] Dashboard loads
- [ ] View stock list
- [ ] Create a test hold/release
- [ ] Dispense a test prescription
- [ ] View movement history

### 6. Rollback (if needed)

```bash
# Revert .env to SQLite settings
# Or restore from backup
```

---

## Post-Cutover

### Frontend Changes Required

**None** - The frontend communicates via API; all changes are backend-only.

### Backend Changes Summary

| File                                    | Change                                     |
| --------------------------------------- | ------------------------------------------ |
| `db/globalPg.ts`                        | NEW - PostgreSQL global pool               |
| `db/tenantPg.ts`                        | NEW - PostgreSQL tenant pool manager       |
| `services/pharmacyServicePg.ts`         | NEW - Transaction-safe pharmacy operations |
| `services/stockReservationServicePg.ts` | NEW - Transaction-safe reservations        |
| `services/stockTransferServicePg.ts`    | NEW - Transaction-safe transfers           |

### Controller Updates

Controllers must be updated to use the new `*Pg.ts` services:

```typescript
// Before
import { pharmacyService } from "../services/pharmacyService";

// After
import { pharmacyServicePg } from "../services/pharmacyServicePg";
```

### SQLite Removal

After successful cutover, SQLite files can be archived:

```bash
# Archive (don't delete yet)
tar -czvf sqlite_backup_$(date +%Y%m%d).tar.gz backend/data/

# Remove from runtime (after 2 weeks of stable operation)
rm -rf backend/data/tenants/*/tenant.db
rm -rf backend/data/global/global.db
```

---

## Monitoring

### Check Connection Pool

```sql
-- Run in pgAdmin or psql
SELECT count(*) as connections
FROM pg_stat_activity
WHERE datname LIKE 'tenant_%' OR datname = 'sahty_global';
```

### Check for Lock Waits

```sql
SELECT * FROM pg_locks WHERE NOT granted;
```

### Application Logs

```bash
# Look for pool errors
grep -i "pool" /var/log/sahty/backend.log
```

---

## Emergency Contacts

- DBA: [TBD]
- DevOps: [TBD]
- Backend Lead: [TBD]
