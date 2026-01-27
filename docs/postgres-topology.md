# PostgreSQL Database Topology

## Overview

Sahty EMR uses a **database-per-tenant** architecture with PostgreSQL:

- **One global database** (`sahty_global`) for shared reference data
- **One database per tenant** (`tenant_{tenant_id}`) for tenant-specific data

## Database Names

| Database       | Purpose                                   | Example                |
| -------------- | ----------------------------------------- | ---------------------- |
| `sahty_global` | Global catalogs, products, DCI, ATC codes | Single instance        |
| `tenant_{id}`  | Tenant data (inventory, EMR, billing)     | `tenant_1768230020156` |

## Connection Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      Application                             │
├─────────────────────────────────────────────────────────────┤
│  globalPg.ts          │  tenantPg.ts                        │
│  ──────────────       │  ────────────                       │
│  Pool → sahty_global  │  Pool Map: tenant_id → Pool         │
│                       │  tenant_1768230020156 → Pool        │
│                       │  tenant_1768230422652 → Pool        │
└───────────┬───────────┴───────────────┬─────────────────────┘
            │                           │
            ▼                           ▼
┌───────────────────┐     ┌───────────────────────────────────┐
│   sahty_global    │     │   tenant_{id} databases           │
└───────────────────┘     └───────────────────────────────────┘
```

## Global Database Tables

| Table                          | Description                     |
| ------------------------------ | ------------------------------- |
| `clients`                      | Healthcare organizations        |
| `organismes`                   | Insurance/payment organizations |
| `users`                        | All system users                |
| `patients`                     | Master patient index            |
| `global_products`              | Product catalog                 |
| `global_suppliers`             | Supplier catalog                |
| `global_dci`                   | Active ingredients              |
| `global_actes`                 | Medical procedures              |
| `global_roles`                 | Role definitions                |
| `global_atc`                   | ATC classification              |
| `global_emdn`                  | Medical device classification   |
| `global_product_price_history` | Price history                   |

## Tenant Database Tables

| Category        | Tables                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Inventory**   | `current_stock`, `inventory_movements`, `stock_reservations`, `product_wac`                    |
| **Procurement** | `purchase_orders`, `po_items`, `delivery_notes`, `delivery_note_items`, `delivery_note_layers` |
| **Transfers**   | `stock_demands`, `stock_demand_lines`, `stock_transfers`, `stock_transfer_lines`               |
| **Clinical**    | `admissions`, `prescriptions`, `appointments`, `actes`, `medication_dispense_events`           |
| **Settings**    | `users`, `roles`, `services`, `service_units`, `rooms`, `locations`, `suppliers`               |
| **Config**      | `product_configs`, `product_suppliers`, `product_price_versions`                               |

## Cross-Database References

Since PostgreSQL does not support cross-database JOINs, references are resolved at the application layer:

```typescript
// Example: Get product details for a stock item
const stock = await tenantPool.query(
  "SELECT * FROM current_stock WHERE product_id = $1",
  [productId],
);
const product = await globalPool.query(
  "SELECT * FROM global_products WHERE id = $1",
  [productId],
);
```

## Tenant Resolution

Tenant ID is extracted from the authenticated user's JWT token and mapped to the database name:

```typescript
const tenantId = jwt.tenant_id; // e.g., "1768230020156"
const dbName = `tenant_${tenantId}`; // "tenant_1768230020156"
```
