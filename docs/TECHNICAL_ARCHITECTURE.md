# Sahty EMR - Technical Architecture Documentation

> **Version:** April 2026  
> **Status:** Active Development  
> **Target Market:** Moroccan Hospital Information Systems

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Multi-Tenancy Model](#4-multi-tenancy-model)
5. [Backend Architecture](#5-backend-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Database Architecture](#8-database-architecture)
9. [Functional Modules](#9-functional-modules)
10. [External Integrations](#10-external-integrations)
11. [Data Flow & Communication](#11-data-flow--communication)
12. [File & Document Storage](#12-file--document-storage)
13. [Deployment Topology](#13-deployment-topology)

---

## 1. System Overview

Sahty EMR is a full-stack, multi-tenant Hospital Information System (HIS) designed for the Moroccan healthcare market. It covers the complete clinical workflow from patient admission through discharge, including pharmacy management, laboratory information management (LIMS), clinical documentation, and administrative operations.

### Key Characteristics

- **Multi-tenant isolation**: Each hospital operates on its own PostgreSQL database
- **Modular architecture**: EMR, Pharmacy, LIMS, and Admin modules activate independently per tenant
- **Dual-realm authentication**: Separate auth paths for hospital staff (tenant) and platform administrators (global)
- **French-language UI**: Designed for the Francophone Moroccan medical environment
- **Moroccan regulatory alignment**: NGAP/CCAM act codes, DCI drug nomenclature, HPRIM messaging

---

## 2. Technology Stack

### Frontend

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React | 19.2.1 |
| Routing | React Router (HashRouter) | 7.10.1 |
| Server State | TanStack React Query | 5.95.2 |
| Build Tool | Vite | 6.2.0 |
| Language | TypeScript | 5.8.2 |
| Styling | Tailwind CSS | CDN |
| Icons | Lucide React | 0.560.0 |
| Rich Text Editor | TipTap | 3.20.1 |
| Charts | Recharts | 3.6.0 |
| 3D Visualization | Three.js + React Three Fiber | 0.183.1 / 9.5.0 |
| PDF Generation | jsPDF + AutoTable | 3.0.4 |
| PDF Viewing | React-PDF + pdfjs-dist | 10.4.1 / 5.5.207 |
| Barcode/QR | jsbarcode, qrcode.react | - |
| Excel Export | SheetJS (XLSX) | 0.18.5 |
| AI Assistant | Google Generative AI (Gemini) | 1.33.0 |
| Notifications | react-hot-toast | - |
| HTML Sanitization | sanitize-html | - |

### Backend

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | - |
| Framework | Express | 4.18.2 |
| Language | TypeScript | 5.3.3 |
| Database Driver | pg (node-postgres) | 8.17.2 |
| Auth | jsonwebtoken + bcryptjs | 9.0.3 / 3.0.3 |
| Object Storage | MinIO SDK | 8.0.7 |
| File Uploads | multer | 2.0.2 |
| Proxy | http-proxy-middleware | 3.0.5 |
| Image Processing | sharp | 0.34.5 |
| PDF Manipulation | pdf-lib | 1.17.1 |
| CSV Processing | csv-parse, csv-writer, papaparse | - |
| HTML Sanitization | sanitize-html | 2.17.1 |
| DOM (Server) | jsdom | 27.4.0 |
| Dev Tools | nodemon + ts-node | 3.0.2 / 10.9.2 |

### Database & Storage

| Layer | Technology |
|---|---|
| Primary Database | PostgreSQL (database-per-tenant) |
| Object Storage | MinIO (S3-compatible, bucket-per-tenant) |
| External Reference | WHO ICD-11 (Docker container, port 8090) |

---

## 3. Architecture Overview

```
                            +------------------+
                            |   Web Browser    |
                            |  (React SPA)     |
                            | localhost:3000    |
                            +--------+---------+
                                     |
                               HTTP (REST)
                                     |
                            +--------+---------+
                            |  Express Server  |
                            |  localhost:3001   |
                            +--------+---------+
                                     |
                 +-------------------+--------------------+
                 |                   |                     |
         +-------+-----+    +------+------+    +--+------+------+
         | sahty_global |    | tenant_001  |    |    tenant_002  |
         | (shared ref) |    | (hospital A)|    |   (hospital B) |
         +-------------+    +------+------+    +---+------+------+
                                   |                      |
                            +------+------+    +----------+-----+
                            | MinIO       |    | MinIO          |
                            | bucket:     |    | bucket:        |
                            | tenant_001  |    | tenant_002     |
                            +-------------+    +----------------+
```

Each tenant gets its own isolated MinIO bucket. Document storage is tenant-scoped — no cross-tenant document access is possible.

### Request Flow

1. Browser sends request to Express (port 3001)
2. Express middleware chain: CORS -> Body Parser -> Route Matching
3. Route-level middleware: `authenticateToken` -> `requireModule` (if protected)
4. Controller extracts tenant context from JWT
5. Service layer executes business logic against tenant-specific database
6. Response returned to frontend

---

## 4. Multi-Tenancy Model

Sahty uses a **database-per-tenant** isolation strategy. Each hospital (tenant) gets its own PostgreSQL database, while shared reference data lives in a single global database.

### Database Topology

```
PostgreSQL Instance
  |
  +-- sahty_global              # Global reference data, super-admin tables
  |     +-- clients             # Tenant registry
  |     +-- global_products     # Medication master catalog
  |     +-- global_dci          # Active pharmaceutical ingredients
  |     +-- global_actes        # Medical acts/procedures
  |     +-- global_roles        # Role templates
  |     +-- global_suppliers    # Supplier registry
  |     +-- global_atc          # WHO ATC classification
  |     +-- global_emdn         # European medical device nomenclature
  |
  +-- tenant_{tenant_id}        # Per-tenant isolated database
  |     +-- auth.*              # Tenant auth schema (users, credentials)
  |     +-- patients_tenant     # Tenant patient records
  |     +-- admissions          # Hospital admissions
  |     +-- prescriptions       # Medication orders
  |     +-- patient_observations # Clinical notes
  |     +-- inventory_movements # Pharmacy stock (event-sourced)
  |     +-- lab_requests        # Laboratory orders
  |     ... (50+ tables)
  |
  +-- tenant_{another_id}       # Another hospital's database
```

### Connection Pooling

Each tenant gets its own connection pool, created on-demand and cached:

```
Per-Tenant Pool Configuration:
  - Max connections: 10 (configurable via PG_POOL_MAX)
  - Idle timeout: 30 seconds
  - Connection timeout: 5 seconds

Global Pool Configuration:
  - Max connections: 20
  - Same timeout settings
```

Pools are lazily initialized on first request and cached in a `Map<tenantId, Pool>`. Graceful shutdown hooks (`SIGTERM`, `SIGINT`) close all pools cleanly.

### Tenant Provisioning

When a new tenant is created:

1. **Phase 1**: Create database `tenant_{id}`, apply baseline schema SQL
2. **Phase 1.1**: Apply identity refactor migrations (schema alignment)
3. **Phase 2**: Seed system locations (quarantine, waste, return locations)
4. **Phase 3**: Sync global reference data into tenant reference schema
5. **Phase 3.1**: Seed default smart phrases and templates
6. **Phase 4**: Configure auth sync triggers

---

## 5. Backend Architecture

### Directory Structure

```
backend/
  +-- server.ts                  # Express app bootstrap, route mounting
  +-- db/
  |     +-- globalPg.ts          # Global database pool (singleton)
  |     +-- tenantPg.ts          # Tenant database pools (per-tenant map)
  +-- middleware/
  |     +-- authMiddleware.ts    # JWT validation, realm enforcement
  |     +-- moduleMiddleware.ts  # RBAC module-based access control
  +-- controllers/               # 44 controller files - HTTP handlers
  +-- services/                  # 53 service files - business logic
  +-- routes/                    # 36 route files - endpoint definitions
  +-- models/                    # TypeScript interfaces for domain objects
  +-- migrations/pg/
  |     +-- global/              # 32 global database migrations
  |     +-- tenant/              # 108+ tenant database migrations
  +-- scripts/                   # Utility scripts, migration runners
  +-- services/integrations/     # External system integrations (HPRIM)
```

### Layered Architecture

```
Routes (Express Router)
   |
   v
Controllers (HTTP request/response handling)
   |   - Extract tenant context from JWT
   |   - Input validation
   |   - HTTP status codes
   v
Services (Business logic)
   |   - Domain rules enforcement
   |   - Transaction management
   |   - Cross-entity orchestration
   v
Database Layer (tenantQuery / globalQuery)
       - Parameterized SQL queries
       - Connection pool management
       - Audit context injection
```

### Server Configuration

- **Port**: 3001 (configurable via `PORT` env)
- **Body Limit**: 20MB for JSON and URL-encoded payloads
- **CORS**: Configured for local development origins (3000, 3001, 3002, 4173, 5173)
- **ICD-11 Proxy**: Reverse proxy to `localhost:8090` for WHO ICD-11 classification lookups

### Route Mounting

```
Unprotected:
  POST /api/auth/*                    # Login, registration
  GET  /health                        # Health check
  GET  /api/global/products           # Public product catalog
  GET  /api/global/dci                # Public DCI catalog
  GET  /api/icd                       # Proxy to ICD-11

Protected (tenant realm):
  /api/settings/*                     # Tenant administration
  /api/emr/*          + EMR module    # Clinical EMR
  /api/pharmacy/*     + PHARMACY mod  # Pharmacy operations
  /api/prescriptions/*                # Prescription management
  /api/observations/*                 # Clinical notes
  /api/stock-transfers/*              # Inter-service stock
  /api/lims/*                         # Laboratory management
  /api/hprim/*                        # HPRIM integration
  /api/allergies/*                    # Allergy management
  /api/escarres/*                     # Pressure ulcer tracking
  ... (36 total route files)

Protected (global realm):
  /api/global/atc/*                   # ATC classification admin
  /api/global/emdn/*                  # EMDN classification admin
  /api/super-admin/*                  # Platform administration
```

### Transaction & Audit Support

Every tenant transaction can inject audit context into PostgreSQL session variables:

```typescript
await tenantTransaction(tenantId, async (client) => {
    // Queries within this block share a transaction
    // with sahty.current_user_id and sahty.client_info set
}, { userId: 'abc-123', clientInfo: '192.168.1.1' });
```

This enables database-level audit triggers to capture who performed each operation.

---

## 6. Frontend Architecture

### Application Structure

```
/ (root)
  +-- App.tsx                    # Router, providers, route definitions
  +-- index.tsx                  # React mount point
  +-- index.html                 # HTML shell with Tailwind CDN
  +-- vite.config.ts             # Build configuration
  +-- context/
  |     +-- AuthContext.tsx       # Authentication state & token management
  |     +-- WorkspaceContext.tsx  # Multi-tab patient dossier management
  +-- services/
  |     +-- api.ts               # Centralized API client (1400+ lines)
  +-- components/
  |     +-- Layout.tsx           # Main app shell (sidebar + content)
  |     +-- PatientDossier/      # Patient record views (25+ components)
  |     +-- Pharmacy/            # Pharmacy module (20+ components)
  |     +-- LIMS/                # Laboratory module
  |     +-- Prescription/        # Prescription management
  |     +-- Settings/            # Tenant administration
  |     +-- SuperAdmin/          # Platform administration
  |     +-- StockTransfer/       # Inter-service stock movements
  |     +-- AdmissionDossier/    # Admission financial dossier
  |     +-- ui/                  # Shared UI primitives
  +-- hooks/                     # Custom React hooks
  +-- types/                     # Shared TypeScript interfaces
  +-- constants/                 # Application constants
```

### Provider Hierarchy

```
<React.StrictMode>
  <QueryClientProvider>         -- TanStack Query (server state)
    <AuthProvider>              -- User session, JWT token
      <HashRouter>
        <Toaster />             -- Toast notifications
        <WorkspaceProvider>     -- Multi-tab dossier state
          <Routes />            -- Application routing
        </WorkspaceProvider>
      </HashRouter>
    </AuthProvider>
  </QueryClientProvider>
</React.StrictMode>
```

### Routing Strategy

The application uses `HashRouter` (URL format: `/#/route`) with nested layouts:

| Route Prefix | Layout | Protection | Module |
|---|---|---|---|
| `/` | Layout (sidebar) | Permission: `emr_patients` | EMR |
| `/settings/*` | SettingsLayout | Role: `TENANT_SUPERADMIN` | Admin |
| `/lims/*` | LIMSLayout | Permission: `lims_parametres` | LIMS |
| `/pharmacy/*` | PharmacyModule | Permission: `ph_dashboard` | Pharmacy |
| `/super-admin/*` | SuperAdminLayout | Role: `SUPER_ADMIN` | Platform |

### Multi-Tab Workspace

The `WorkspaceContext` manages up to **5 concurrent patient dossier tabs**:

```
WorkspaceTab {
  workspaceId: string          // Unique tab identifier
  patientId?: string           // For patient tabs
  label: string                // Display name (patient name)
  activeDossierTab?: string    // Current sub-tab (Parcours, Observations...)
  lastVisitedAt: number        // For LRU tab switching
  type: 'patient' | 'utility'  // Tab type
}
```

- Tabs auto-create when navigating to `/patient/:id`
- Closing the active tab switches to the most recently visited tab (LRU)
- Tab overflow (>5) shows an error toast

### API Client

All backend communication goes through a centralized `api` object in `services/api.ts`:

```typescript
// Core utility
async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T>

// Automatic behaviors:
// - Reads JWT from localStorage, attaches as Bearer token
// - Sets Content-Type: application/json (skipped for FormData)
// - 401 response: removes token, triggers logout
// - Error responses: parses error body, attaches to Error object
```

The API base URL is `http://localhost:3001/api`.

---

## 7. Authentication & Authorization

### JWT-Based Authentication

```
Login Flow:
  1. POST /api/auth/login { username, password }
  2. Backend validates credentials (bcrypt)
  3. Returns { token: JWT, user: UserObject }
  4. Frontend stores token in localStorage
  5. All subsequent requests include: Authorization: Bearer <token>

Session Verification:
  - On page load, GET /api/auth/me validates the stored token
  - 401/403 triggers logout; network errors preserve the session
```

### JWT Payload Structure

```typescript
{
  userId: string
  firstName: string
  lastName: string
  tenantId: string          // Which hospital
  role: string              // Role identifier
  realm: 'tenant' | 'global'  // Auth realm
  permissions: string[]     // Granular permission codes
  modules: string[]         // Feature module access
  service_ids: string[]     // Accessible hospital services
}
```

### Dual-Realm System

| Realm | Users | Access Scope |
|---|---|---|
| `tenant` | Hospital staff (doctors, nurses, pharmacists, admins) | Single tenant database |
| `global` | Platform super-administrators | Global database + all tenants |

**Enforcement**: The `authenticateToken` middleware rejects any non-`tenant` realm request. Only specific endpoints use `authenticateAnyToken` for cross-realm access.

### Authorization Layers

```
Layer 1 - Authentication:  authenticateToken (JWT valid?)
Layer 2 - Realm:           tenant vs global realm enforcement
Layer 3 - Module:          requireModule('EMR') - feature flag check
Layer 4 - Permission:      hasPermission('emr_patients') - granular action check
Layer 5 - Service Scope:   service_ids[] - which departments user can access
```

**Super Admin Bypass**: Users with `SUPER_ADMIN` or `PUBLISHER_SUPERADMIN` type bypass module checks.

---

## 8. Database Architecture

### Schema Evolution

The database schema evolves through numbered SQL migration files. There are currently **108+ tenant migrations** (000-124) and **32 global migrations**.

```
Migration Naming: {number}_{description}.sql
Examples:
  000_init.sql                          # Initial schema bootstrap
  051_prescriptions_refactor.sql        # Prescription system overhaul
  076_create_patient_observations.sql   # Clinical notes
  082_lab_reference_catalog.sql         # Lab reference system
  121_ecg_echo_records.sql              # Cardiology records
  124_technical_unit_types.sql          # Technical unit configuration
```

### Core Domain Model

```
                          +------------------+
                          |  patients_tenant |
                          +--------+---------+
                                   |
                +------------------+------------------+
                |                  |                   |
       +--------+-------+  +------+------+  +---------+--------+
       |   admissions   |  |  allergies  |  |   observations   |
       +--------+-------+  +-------------+  +------------------+
                |
      +---------+----------+-----------+----------+
      |         |          |           |          |
  +---+-----+  |   +------+---+ +----+----+ +---+---+
  | prescrip|  |   |  stays   | | surv    | | ecg/  |
  | tions   |  |   |  (beds)  | | events  | | echo  |
  +---+-----+  |   +----------+ +---------+ +-------+
      |         |
      +----+----+---------- (same transaction if type=biology) --+
      |         |                                                |
      |   +-----+-------+                                       |
      |   | lab_requests |  (FK to prescription + lab_collection)|
      |   +-----+--------+                                      |
      |         |                                                |
      |   +-----+-------+    +----------------+                 |
      |   | lab_results  |   | lab_collections| <---------------+
      |   +-------------+    +----------------+
      |
  +---+----------------+
  | prescription_events|  (scheduled times = MAR source of truth)
  +---+----------------+
      |
  +---+-------------------+
  | administration_events  |  (actual performed administration)
  +---+----+----+----+----+
      |    |    |    |
      |    |    |    +-- administration_event_blood_bags (FK)
      |    |    |            +-- transfusion_blood_bags
      |    |    |            +-- transfusion_checks (1:1)
      |    |    |            +-- transfusion_reactions
      |    |    |
      |    |    +-- administration_event_lab_collections (FK)
      |    |            (links administration to specimen collection)
      |    |
      |    +-- (other domain-specific child entities via FK)
      |
      +-- performer_user_id, administered_quantity, flowsheet_id
```

**Key relationship**: When a prescription of type `biology` is created, both the `prescriptions` row and the corresponding `lab_requests` row are inserted in the **same transaction**. The lab request references both the prescription and the lab collection. Administration events are the universal execution record — specialized child entities (blood bags, lab collections, etc.) link to them via foreign keys.

### Key Tables

#### Patient Identity
- `patients_tenant` - Core patient demographics (tenant-scoped)
- `identity_ids` - Multiple identity documents per patient (CIN, passport, etc.)
- `patient_addresses`, `patient_contacts`, `patient_relationship_links`

#### Clinical
- `admissions` - Hospital stays with service assignment and admission type
- `patient_observations` - Clinical notes with DRAFT/SIGNED/ENTERED_IN_ERROR state machine
- `clinical_exams` - Structured examination headers
- `patient_ecg_records`, `patient_echo_records` - Cardiology-specific structured data
- `patient_allergies` + `patient_allergy_manifestations` - Allergy registry
- `patient_addictions` - Substance use documentation
- `surveillance_events` - Vital signs and I/O monitoring (JSONB flowsheets)

#### Prescriptions & Administration

The prescription chain follows a strict hierarchy: **prescriptions -> prescription_events -> administration_events -> domain-specific child entities**.

- `prescriptions` - Medication/lab/imaging/care/transfusion orders with JSONB details
- `lab_requests` - Created **in the same transaction** as the prescription when `prescription_type = 'biology'`. References both the prescription and the lab collection.
- `prescription_events` - Scheduled administration times (MAR source of truth)
- `administration_events` - Actual performed administration records with performer tracking
- `administration_event_blood_bags` - Links an administration event to transfusion blood bags (FK to `administration_events`)
- `administration_event_lab_collections` - Links an administration event to specimen collection (FK to `administration_events`)
- `transfusion_blood_bags` - Blood product tracking through full lifecycle (RECEIVED -> ISSUED -> ADMINISTERED/CANCELLED/WASTED)
- `transfusion_checks` - Pre-administration safety checks (1:1 with administration event)
- `transfusion_reactions` - Post-administration adverse reaction records

#### Laboratory
- `lab_collections` - Sample collection sessions
- `lab_specimens` + `lab_specimen_containers` - Specimen lifecycle
- `lab_requests` - Test orders linked to both a prescription and a lab collection via foreign keys
- `patient_lab_reports` - Report headers (external or internal)
- `patient_lab_results` - Individual test results (numeric, text, boolean, choice)

#### Pharmacy & Stock
- `inventory_movements` - **Append-only event log** (event sourcing pattern)
- `current_stock` - Materialized snapshot of stock levels per location
- `product_wac` - Weighted Average Cost tracking
- `stock_reservations` - Pharmacy basket holds
- `delivery_notes` + `delivery_note_items` - Goods receipt
- `purchase_orders` + `po_lines` - Procurement

#### Reference Catalog (Global)
- `global_actes` - Medical acts with SIH famille/sous-famille hierarchy
- `global_products` - Medication catalog with pricing tiers (PPV, PH, PFHT)
- `global_dci` - Active pharmaceutical ingredients + synonyms
- `global_atc` - WHO ATC drug classification tree
- `global_emdn` - European medical device nomenclature
- `lab_analytes`, `lab_panels`, `lab_sections` - Laboratory reference structure

### Design Patterns

**Soft Deletes**: No physical DELETE operations. All entities use `is_active` boolean or status enums (`ACTIVE`, `ENTERED_IN_ERROR`).

**Audit Trail**: Most tables carry `created_by`, `updated_by`, `created_at`, `updated_at`. Specialized history tables exist for allergies, coverages, and clinical status changes.

**Denormalization**: Author names (`first_name`, `last_name`) are snapshotted at write time to avoid expensive JOINs for display and to preserve historical accuracy.

**Event Sourcing (Inventory)**: Stock movements are append-only. Current stock is a materialized view computed from the movement log, ensuring complete audit trail.

**JSONB for Flexibility**: Prescription scheduling details and surveillance flowsheet data use JSONB columns to accommodate complex, evolving schemas without migrations.

---

## 9. Functional Modules

### 9.1 EMR (Electronic Medical Record)

The core clinical module covering the patient journey:

- **Patient Registry**: Identity management, IPP generation, demographic capture
- **Admissions**: Hospitalization, consultation, and order-only admission types with service assignment
- **Patient Dossier**: Tab-based interface with sub-tabs for Parcours, Observations, Prescriptions, Biology, Imagerie, ECG/Echo, Allergies, Escarres, Transfusions, etc.
- **Clinical Observations**: Rich-text notes with DRAFT -> SIGNED state machine, addendum support, and entered-in-error handling
- **Surveillance (Fiche de Surveillance)**: Vital signs, fluid balance (I/O), hourly bucketed monitoring
- **Prescriptions**: Medication, biology, imagery, care, procedure, and transfusion orders
- **Administration**: MAR (Medication Administration Record) with scheduled events and actual administration tracking

### 9.2 Pharmacy

Complete pharmacy operations from procurement to patient administration:

- **Product Catalog**: Global medication database with DCI composition, ATC classification
- **Stock Management**: Event-sourced inventory with WAC costing, multi-location support
- **Procurement**: Purchase orders, delivery notes with layer tracking (batch/expiry)
- **Dispensation**: Prescription-linked drug dispensing
- **Stock Transfers**: Inter-service demand/fulfillment workflow
- **Returns**: Internal and supplier return management with quarantine
- **Quarantine**: Suspect product isolation and disposition

### 9.3 LIMS (Laboratory Information Management)

End-to-end laboratory workflow:

- **Registration**: Lab order creation linked to patient admissions
- **Collection**: Specimen collection with container type validation
- **Reception**: Sample receipt confirmation and quality assessment
- **Execution**: Result entry with reference range evaluation (age/sex-specific)
- **Validation**: Technical and biological validation workflow
- **Reporting**: Structured result reports with PDF generation
- **Reference Catalog**: Hierarchical classification (sections -> sub-sections -> panels -> analytes)

### 9.4 Settings (Parametrage)

Tenant-level configuration:

- **Users & Roles**: Staff account management, role assignment
- **Services**: Hospital department definitions with personnel and stock
- **Rooms & Beds**: Physical space hierarchy (room types -> rooms -> beds)
- **Plateaux Techniques**: Technical unit types (OR, consultation boxes, imaging rooms)
- **Actes & Prix**: Medical act pricing configuration
- **Smart Phrases**: Clinical note templates with dynamic token insertion
- **External Systems**: External integration configuration (EVM, HPRIM)

### 9.5 Super Admin (Platform)

Global platform management:

- **Tenant Management**: Hospital onboarding and provisioning
- **Global Catalogs**: Products, DCI, suppliers, actes, ATC, EMDN
- **LIMS Catalogs**: Analytes, methods, specimens, containers, sections
- **Role Templates**: Permission and module definitions
- **Flowsheet Configuration**: Observation catalog templates

---

## 10. External Integrations

### ICD-11 (WHO Classification)

- **Method**: HTTP reverse proxy from Express to a local Docker container
- **Route**: `/api/icd` -> `localhost:8090`
- **Purpose**: Disease and condition classification lookup during diagnosis entry
- **Auth**: No authentication required (proxied directly)

### HPRIM (Healthcare Messaging)

French/Moroccan healthcare interoperability standard for lab result exchange:

```
backend/services/integrations/hprim/
  +-- hprimParser.ts         # Parse inbound HPRIM messages
  +-- hprimSerializer.ts     # Serialize outbound HPRIM messages
  +-- hprimInboundService.ts # Process incoming lab results
  +-- hprimOutboundService.ts# Send lab orders to external systems
  +-- hprimMappingService.ts # Map external codes to internal catalog
  +-- hprimFileService.ts    # File-based message exchange
  +-- hprimWorker.ts         # Background polling worker
  +-- hprimConfig.ts         # Connection configuration
  +-- hprimTypes.ts          # TypeScript type definitions
```

- **External Code Mapping**: `global_act_external_codes` table maps internal actes to external system codes (EVM, HPRIM)
- **Bidirectional**: Sends lab orders out, receives structured results back

### MinIO (Document Storage)

- **Purpose**: S3-compatible object storage for lab reports, scanned documents, PDFs
- **SDK**: `minio` npm package (v8.0.7)
- **Tenant Isolation**: Each tenant gets its own MinIO bucket (`tenant_{id}`). No cross-tenant document access is possible, mirroring the database-per-tenant strategy.
- **Integration**: `MinioDocumentStorageProvider` service wraps upload/download operations
- **Use Cases**: Lab report PDFs, patient document uploads, prescription printouts

### Google Gemini AI

- **SDK**: `@google/genai` (v1.33.0)
- **Purpose**: AI assistant for clinical note assistance
- **API Key**: Injected via `GEMINI_API_KEY` environment variable

---

## 11. Data Flow & Communication

### Frontend -> Backend Communication

```
React Component
    |
    +-- useEffect / onClick / onSubmit
    |
    +-- api.someMethod(params)          // services/api.ts
    |       |
    |       +-- fetchJson('/endpoint', { method, body })
    |       |       |
    |       |       +-- Reads token from localStorage
    |       |       +-- Sets Authorization: Bearer <token>
    |       |       +-- Sets Content-Type: application/json
    |       |       +-- fetch('http://localhost:3001/api/endpoint')
    |       |
    |       +-- Error handling:
    |               401 -> logout
    |               Other -> throw Error with server message
    |
    +-- setState(response) / queryClient.invalidateQueries()
```

### Backend Request Processing

```
Incoming Request
    |
    +-- CORS middleware
    +-- Body parser (JSON, 20MB limit)
    +-- Route matching
    |
    +-- authenticateToken (JWT validation)
    |       +-- Decode JWT
    |       +-- Enforce realm = 'tenant'
    |       +-- Populate req.auth { userId, tenantId, modules, permissions }
    |
    +-- requireModule('MODULE_NAME')  [if protected]
    |       +-- Check req.auth.modules includes required module
    |       +-- Super admin bypass
    |
    +-- Controller
    |       +-- Extract tenantId via getContext(req)
    |       +-- Call service method
    |       +-- Return HTTP response
    |
    +-- Service
    |       +-- Business logic
    |       +-- tenantQuery(tenantId, sql, params)  [parameterized SQL]
    |       +-- Cross-service coordination
    |
    +-- Database
            +-- getTenantPool(tenantId) [from pool cache]
            +-- Execute query on tenant_{tenantId} database
            +-- Return rows
```

### Observation State Machine

Clinical observations follow a strict lifecycle:

```
              +-------+
     Create   | DRAFT |   Edit (by author only)
   +--------->+---+---+<-----------+
              |   |                |
              |   | Sign           |
              |   v                |
              | +--------+         |
              | | SIGNED |         |
              | +---+----+         |
              |     |    ^         |
              |     |    | Addendum (creates child, always SIGNED)
              |     |    |
              |     | Enter in Error
              |     v
              | +---+----------------+
              | | ENTERED_IN_ERROR   |  (cascades to addendums)
              | +--------------------+
              |
              | Discard (DRAFT only - hard delete)
              v
           [Deleted]
```

### Inventory Event Sourcing

```
CREATE movement (append-only)
    |
    +-- INSERT INTO inventory_movements (type, qty, batch, location...)
    |
    +-- Trigger/Service recomputes:
    |       +-- UPDATE current_stock SET quantity = SUM(movements)
    |       +-- UPDATE product_wac SET cost = weighted_average(movements)
    |
    +-- Movement types:
            RECEIPT, DISPENSATION, TRANSFER_IN, TRANSFER_OUT,
            RETURN, ADJUSTMENT, WASTE, QUARANTINE_IN, QUARANTINE_OUT
```

---

## 12. File & Document Storage

### MinIO Integration

Document storage follows the same tenant-isolation principle as the database. Each tenant gets its own MinIO bucket, ensuring complete data separation.

```
Application Layer
    |
    +-- MinioDocumentStorageProvider
    |       +-- upload(tenantBucket, key, buffer, metadata)
    |       +-- download(tenantBucket, key) -> Stream
    |       +-- delete(tenantBucket, key)
    |
    +-- Multer middleware (file upload parsing)
            +-- Handles multipart/form-data
            +-- Streams to MinIO via provider

Storage Structure (per tenant):
  minio/
    +-- tenant_{id}/
          +-- lab-reports/           # Lab report PDFs
          +-- patient-documents/     # Scanned documents
          +-- prescriptions/         # Generated prescription PDFs
```

### PDF Generation

- **jsPDF + AutoTable**: Server-side and client-side PDF generation for prescriptions, lab reports
- **pdf-lib**: Server-side PDF manipulation (merging, stamping)
- **react-pdf**: Client-side PDF viewing in the browser

---

## 13. Deployment Topology

### Development Environment

```
+-------------------+     +-------------------+     +-------------------+
|  Vite Dev Server  |     |  Express Server   |     |   PostgreSQL      |
|  localhost:3000   |---->|  localhost:3001    |---->|   localhost:5432  |
|  (React SPA)      |     |  (REST API)       |     |   sahty_global    |
+-------------------+     +---+---------------+     |   tenant_*        |
                              |                     +-------------------+
                              |
                    +---------+---------+
                    |                   |
              +-----+------+     +-----+------+
              |   MinIO    |     | ICD-11     |
              | :9000/:9001|     | Docker     |
              | (S3 store) |     | :8090      |
              +------------+     +------------+
```

### Environment Variables

```bash
# Database
PG_HOST=localhost
PG_PORT=5432
PG_USER=sahty
PG_PASSWORD=sahty_dev_2026
PG_GLOBAL_DB=sahty_global
PG_TENANT_DB_PREFIX=tenant_
PG_POOL_MAX=10
PG_POOL_IDLE_TIMEOUT=30000
PG_POOL_CONNECTION_TIMEOUT=5000

# Auth
JWT_SECRET=super-secret-key-change-in-prod

# Server
PORT=3001

# AI
GEMINI_API_KEY=...

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
```

### Build Commands

```bash
# Frontend
npm run dev          # Vite dev server on :3000
npm run build        # Production build to dist/
npm run preview      # Preview production build

# Backend
cd backend
npx nodemon server.ts   # Dev server with hot reload on :3001
```

---

## Appendix: Migration Index

| Range | Phase | Description |
|---|---|---|
| 000-008 | Foundation | Initial schema, auth setup, patient refactoring |
| 009-025 | Clinical Core | Admissions, placement, rooms, beds, diagnoses |
| 040-043 | Identity | Destructive identity schema reorganization |
| 044-049 | Insurance | Coverage system at admission level |
| 051-060 | Prescriptions | Medication order system with MAR events |
| 063-081 | Documentation | Allergies, observations, clinical exams, smart phrases |
| 082-099 | Laboratory | Complete lab reference and result persistence |
| 106-115 | LIMS Integration | External systems, HPRIM, specimen lifecycle |
| 116-120 | Stock Improvements | Demands, purchase orders, stock constraints |
| 121-123 | Cardiology | ECG/Echo structured records with observation linking |
| 124 | Infrastructure | Technical unit types (plateaux techniques) |
