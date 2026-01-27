# Pharmacy Engine Concurrency Safety

## Problem Statement

The SQLite-based pharmacy engine relied on SQLite's file-level locking to serialize concurrent operations. PostgreSQL uses row-level locking, which means concurrent operations can interleave and corrupt data if not properly synchronized.

### Critical Race Condition: Read-Modify-Write (RMW)

**Broken Pattern (SQLite-era):**

```javascript
// STEP 1: READ (acquires no lock in PostgreSQL)
const stock = await getStock(tenantId, location, productId);

// STEP 2: MODIFY (in-memory, gap between read and write)
const available = stock.filter((s) => s.qty_units > 0);
available.sort((a, b) => a.expiry - b.expiry); // FEFO
const take = Math.min(position.qty_units, remaining);

// STEP 3: WRITE (another transaction may have modified the row)
await upsertStock(tenantId, productId, lot, location, -take);
```

**Race Scenario:**

1. Nurse A reads `qty_units = 10`
2. Nurse B reads `qty_units = 10` (same stale value)
3. Nurse A dispenses 5 → writes `qty_units = 5`
4. Nurse B dispenses 5 → writes `qty_units = 5` (overwrites A's change!)
5. **Result:** 10 units consumed, database shows 5 remaining

---

## Solution: Transaction + Row Locking

### Strategy 1: SELECT FOR UPDATE

Lock rows before reading to prevent concurrent reads:

```sql
BEGIN;

-- Lock the stock rows
SELECT * FROM current_stock
WHERE tenant_id = $1 AND product_id = $2 AND location = $3 AND qty_units > 0
ORDER BY expiry ASC
FOR UPDATE;

-- Calculate FEFO allocation in application
-- Perform deduction
UPDATE current_stock
SET qty_units = qty_units - $4
WHERE tenant_id = $1 AND product_id = $2 AND lot = $5 AND location = $3;

COMMIT;
```

### Strategy 2: Guarded Atomic UPDATE

Use a WHERE clause to ensure sufficient stock exists:

```sql
UPDATE current_stock
SET qty_units = qty_units - $1
WHERE tenant_id = $2
  AND product_id = $3
  AND lot = $4
  AND location = $5
  AND qty_units >= $1  -- Guard: only update if sufficient
RETURNING *;

-- If rowCount = 0, insufficient stock (fail gracefully)
```

### Chosen Approach: Hybrid

We use **both strategies** for maximum safety:

1. **SELECT FOR UPDATE** to lock and read FEFO-ordered stock
2. **Guarded UPDATE** as a safety net to prevent negative stock

---

## Implementation Details

### Transaction Wrapper Pattern

All pharmacy operations use a consistent transaction pattern:

```typescript
import { tenantTransaction } from "../db/tenantPg";

async function dispense(tenantId: string, items: DispenseItem[]) {
  return tenantTransaction(tenantId, async (client) => {
    // All operations use the same client within the transaction

    // 1. Lock stock rows
    const stock = await client.query(
      `
            SELECT * FROM current_stock 
            WHERE tenant_id = $1 AND product_id = ANY($2) AND location = $3 AND qty_units > 0
            ORDER BY expiry ASC
            FOR UPDATE
        `,
      [tenantId, productIds, location],
    );

    // 2. Calculate FEFO allocation
    const allocations = calculateFEFO(stock.rows, items);

    // 3. Deduct with guard
    for (const alloc of allocations) {
      const result = await client.query(
        `
                UPDATE current_stock 
                SET qty_units = qty_units - $1
                WHERE tenant_id = $2 AND product_id = $3 AND lot = $4 AND location = $5
                  AND qty_units >= $1
                RETURNING *
            `,
        [alloc.qty, tenantId, alloc.productId, alloc.lot, location],
      );

      if (result.rowCount === 0) {
        throw new Error(
          `Insufficient stock for ${alloc.productId} lot ${alloc.lot}`,
        );
      }
    }

    // 4. Record movements
    await recordMovements(client, allocations);

    // Transaction commits automatically
  });
}
```

### Methods Requiring Transaction Wrapping

| Method                | Service                 | Lock Type  | Notes                              |
| --------------------- | ----------------------- | ---------- | ---------------------------------- |
| `dispense()`          | PharmacyService         | FOR UPDATE | Lock all stock rows being depleted |
| `transfer()`          | PharmacyService         | FOR UPDATE | Lock source location stock         |
| `processQuarantine()` | PharmacyService         | FOR UPDATE | Lock quarantine items              |
| `hold()`              | StockReservationService | FOR UPDATE | Lock stock for reservation         |
| `commitSession()`     | StockReservationService | FOR UPDATE | Lock reservations and stock        |
| `releaseSession()`    | StockReservationService | FOR UPDATE | Lock reservations only             |
| `executeTransfer()`   | StockTransferService    | FOR UPDATE | Lock source and create dest        |

### Idempotency Keys

Stock reservations use `client_request_id` as an idempotency key:

```sql
CREATE UNIQUE INDEX idx_res_idempotency
ON stock_reservations(tenant_id, client_request_id)
WHERE client_request_id IS NOT NULL;
```

This prevents duplicate reservations from retried requests.

---

## Concurrency Testing

### Test Scenarios

1. **Parallel Hold Attempt**
   - 2 users try to hold 8 units when only 10 available
   - Expected: First succeeds with 8, second gets only 2

2. **Overlapping Dispense**
   - 2 dispensations target the same lot concurrently
   - Expected: One waits for the other; no over-deduction

3. **Commit vs Release Race**
   - User A commits session while cleanup job releases expired
   - Expected: Commit fails if already released (check status first)

### Simulation Script

```bash
npx ts-node scripts/verify/concurrency_sim.ts
```

---

## Monitoring

### Lock Wait Detection

```sql
SELECT
    blocked.pid AS blocked_pid,
    blocked.query AS blocked_query,
    blocking.pid AS blocking_pid,
    blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
    ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.wait_event_type = 'Lock';
```

### Long-Running Transactions

```sql
SELECT pid, now() - xact_start AS duration, query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
  AND state = 'active'
ORDER BY duration DESC;
```

---

## Error Handling

### Conflict Resolution

If a transaction fails due to lock timeout or deadlock:

1. **Retry with backoff** (up to 3 times)
2. **Log the conflict** for investigation
3. **Return clear error to user** ("Operation busy, please retry")

### Deadlock Prevention

We always lock rows in a consistent order:

- By `product_id` first
- Then by `lot`
- Then by `location`

This prevents A→B, B→A deadlock patterns.
