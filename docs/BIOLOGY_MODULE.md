# Sahty EMR - Biology / LIMS Module - Technical Documentation

> **Version:** April 2026  
> **Scope:** Complete biology workflow — from prescription to HPRIM result exchange

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Architecture](#2-architecture)
3. [Database Schema — Reference Tables](#3-database-schema--reference-tables)
4. [Database Schema — Operational Tables](#4-database-schema--operational-tables)
5. [Database Schema — External Integration Tables](#5-database-schema--external-integration-tables)
6. [Database Schema — Shared Tables](#6-database-schema--shared-tables)
7. [Entity Relationship Model](#7-entity-relationship-model)
8. [Backend Layer — Controllers, Services, Routes](#8-backend-layer--controllers-services-routes)
9. [Frontend Layer — Components & API Client](#9-frontend-layer--components--api-client)
10. [Workflow A: Hospitalized Patient](#10-workflow-a-hospitalized-patient)
11. [Workflow B: Walk-In Patient](#11-workflow-b-walk-in-patient)
12. [HPRIM Integration — When Messages Are Generated](#12-hprim-integration--when-messages-are-generated)

---

## 1. Module Overview

The Biology module spans two distinct operational zones:

1. **Inside the Medical Dossier** (EMR-integrated): Prescription creation, specimen collection via the Fiche de Surveillance, and result viewing in the patient dossier.
2. **Inside the LIMS** (standalone laboratory module): Patient registration (walk-ins), specimen collection, specimen reception, and laboratory configuration.

The **boundary** between these two zones is the **Reception** step — when a specimen physically arrives at the lab and is scanned in. Everything before reception can happen at the bedside (hospitalized) or at the LIMS front desk (walk-in). Everything after reception is pure laboratory territory.

---

## 2. Architecture

### Layers

```
Frontend Components
  |
  +-- /components/Prescription/BiologyPrescriptionForm.tsx    (EMR: prescribe tests)
  +-- /components/PatientDossier/FicheSurveillance.tsx         (EMR: bedside collection)
  +-- /components/PatientDossier/Biologie.tsx                  (EMR: view results)
  +-- /components/LIMS/Registration/                           (LIMS: walk-in registration)
  +-- /components/LIMS/Collection/LimsCollectionPage.tsx       (LIMS: walk-in collection)
  +-- /components/LIMS/Reception/LimsReceptionPage.tsx         (LIMS: specimen QA & receive)
  +-- /components/LIMS/AnalyteContextsPage.tsx                 (LIMS: configuration)
  +-- /components/LIMS/BiologyActsPage.tsx                     (LIMS: act configuration)

API Client (services/api.ts)
  |
  +-- api.limsConfig.*                    (LIMS configuration endpoints)
  +-- api.limsConfig.execution.*          (LIMS execution endpoints)
  +-- api.receiveSpecimen() / rejectSpecimen() / markSpecimenInsufficient()
  +-- api.createPrescription()            (shared prescription endpoint)

Backend Routes
  |
  +-- /api/lims/*                         (limsRoutes.ts — configuration)
  +-- /api/lims/execution/*               (limsExecutionRoutes.ts — collection, requests)
  +-- /api/lims/reception/*               (limsReceptionRoutes.ts — specimen QA)
  +-- /api/prescriptions/*                (prescriptionRoutes.ts — biology prescriptions)

Backend Services
  |
  +-- limsService.ts                      (reference data CRUD)
  +-- limsExecutionService.ts             (collection, specimen creation, lab requests)
  +-- limsReceptionService.ts             (specimen receive/reject/insufficient)
  +-- prescriptionService.ts              (creates prescriptions + lab_requests in same tx)
  +-- hprimOutboundService.ts             (generates ORM messages)
  +-- hprimInboundService.ts              (consumes ORU results)

Database (tenant_{id})
  |
  +-- reference schema                    (lab catalog: analytes, specimens, containers, panels)
  +-- public schema                       (operational: lab_requests, lab_specimens, lab_collections)
  +-- public schema                       (HPRIM: lab_hprim_messages, lab_hprim_links)
```

---

## 3. Database Schema — Reference Tables

All reference tables live in the `reference` schema inside each tenant database. They define the laboratory's test catalog, specimen rules, and interpretation ranges.

### 3.1 Classification Hierarchy

#### `reference.lab_sections`
**Purpose:** Layer 1 classification of laboratory tests (chapters like "Hematology", "Biochemistry").

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() |
| `sous_famille_id` | UUID | NOT NULL, FK → `reference.sih_sous_familles(id)` |
| `code` | TEXT | NOT NULL, UNIQUE per sous_famille |
| `libelle` | TEXT | NOT NULL |
| `description` | TEXT | |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

#### `reference.lab_sub_sections`
**Purpose:** Layer 2 classification under sections (sub-chapters like "Coagulation" under "Hematology").

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `section_id` | UUID | NOT NULL, FK → `lab_sections(id)` |
| `code` | TEXT | NOT NULL, UNIQUE per section |
| `libelle` | TEXT | NOT NULL |
| `description` | TEXT | |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

### 3.2 Test Panels

#### `reference.lab_panels`
**Purpose:** Prescribable test groupings. A panel can contain individual acts or other panels (recursive). Linked to `global_actes` via `global_act_id`.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `sous_famille_id` | UUID | NOT NULL, FK → `sih_sous_familles(id)` |
| `section_id` | UUID | FK → `lab_sections(id)` |
| `sub_section_id` | UUID | FK → `lab_sub_sections(id)` |
| `code` | TEXT | NOT NULL, UNIQUE |
| `libelle` | TEXT | NOT NULL |
| `description` | TEXT | |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `is_prescribable` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `expand_to_child_tests` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `is_panel` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `billing_mode` | TEXT | NOT NULL DEFAULT 'DECOMPOSED', CHECK IN ('PANEL','DECOMPOSED') |
| `global_act_id` | UUID | NOT NULL, UNIQUE, FK → `global_actes(id)` |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

#### `reference.lab_panel_items`
**Purpose:** Composition of panels — each item is either a child panel (`item_type='PANEL'`) or a child act (`item_type='ACT'`). Exclusive CHECK constraint prevents both being set.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `panel_id` | UUID | NOT NULL, FK → `lab_panels(id)` |
| `item_type` | TEXT | NOT NULL, CHECK IN ('PANEL','ACT') |
| `child_panel_id` | UUID | FK → `lab_panels(id)`, required when item_type='PANEL' |
| `child_global_act_id` | UUID | FK → `global_actes(id)`, required when item_type='ACT' |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 |
| `is_required` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `quantity` | NUMERIC(12,3) | |
| `notes` | TEXT | |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |

**Constraint:** `panel_id != child_panel_id` (no self-reference)

### 3.3 Analytes (Test Parameters)

#### `reference.lab_analytes`
**Purpose:** Atomic measurable parameters (glucose, hemoglobin, WBC count, etc.).

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `sous_famille_id` | UUID | NOT NULL, FK → `sih_sous_familles(id)` |
| `section_id` | UUID | FK → `lab_sections(id)` |
| `sub_section_id` | UUID | FK → `lab_sub_sections(id)` |
| `code` | TEXT | NOT NULL, UNIQUE |
| `libelle` | TEXT | NOT NULL |
| `short_label` | TEXT | |
| `description` | TEXT | |
| `value_type` | TEXT | NOT NULL, CHECK IN ('NUMERIC','TEXT','BOOLEAN','CHOICE') |
| `default_unit_id` | UUID | FK → `units(id)` |
| `canonical_unit_id` | UUID | FK → `units(id)` |
| `decimal_precision` | INTEGER | |
| `is_calculated` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 |

#### `reference.lab_analyte_contexts`
**Purpose:** Pre-computed combinations of analyte + specimen type + unit + method. This is the core entity that links a measurable parameter to how it's measured. Denormalized labels cached for fast rendering.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `analyte_id` | UUID | NOT NULL, FK → `lab_analytes(id)` |
| `specimen_type_id` | UUID | NOT NULL, FK → `lab_specimen_types(id)` |
| `unit_id` | UUID | NOT NULL, FK → `units(id)` |
| `method_id` | UUID | FK → `lab_methods(id)` |
| `analyte_label` | TEXT | NOT NULL (denormalized) |
| `specimen_label` | TEXT | NOT NULL (denormalized) |
| `unit_label` | TEXT | NOT NULL (denormalized) |
| `method_label` | TEXT | (denormalized) |
| `is_default` | BOOLEAN | DEFAULT FALSE |
| `actif` | BOOLEAN | DEFAULT TRUE |

**Unique:** `(analyte_id, specimen_type_id, unit_id, COALESCE(method_id, NULL_UUID))`

#### `reference.lab_analyte_units`
**Purpose:** Valid units per analyte with deterministic conversion factors.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `analyte_id` | UUID | NOT NULL, FK → `lab_analytes(id)` |
| `unit_id` | UUID | NOT NULL, FK → `units(id)` |
| `is_default` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `is_canonical` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `conversion_factor` | NUMERIC | NOT NULL DEFAULT 1 |
| `conversion_offset` | NUMERIC | NOT NULL DEFAULT 0 |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |

**Partial unique indexes:** One default per analyte, one canonical per analyte.

#### `reference.lab_analyte_aliases`
**Purpose:** Alternative names for analytes (OCR variants, external system labels, abbreviations).

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `analyte_id` | UUID | NOT NULL, FK → `lab_analytes(id)` |
| `alias_text` | TEXT | NOT NULL |
| `alias_type` | TEXT | NOT NULL DEFAULT 'DISPLAY', CHECK IN ('DISPLAY','OCR','EXTERNAL','SHORT','ABBREVIATION') |
| `language_code` | TEXT | |
| `source_system` | TEXT | |
| `is_preferred` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |

### 3.4 Specimens & Containers

#### `reference.lab_specimen_types`
**Purpose:** Types of biological specimens (blood, urine, CSF, etc.).

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `code` | TEXT | NOT NULL, UNIQUE |
| `libelle` | TEXT | NOT NULL |
| `description` | TEXT | |
| `base_specimen` | TEXT | NOT NULL |
| `matrix_type` | TEXT | NOT NULL |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 |

#### `reference.lab_container_types`
**Purpose:** Physical container specifications (tube types with color and additive info).

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `code` | TEXT | NOT NULL, UNIQUE |
| `libelle` | TEXT | NOT NULL |
| `description` | TEXT | |
| `additive_type` | TEXT | |
| `tube_color` | TEXT | |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `sort_order` | INTEGER | |

#### `reference.lab_specimen_container_types`
**Purpose:** Valid specimen-container combinations (e.g., "Blood" can go in "EDTA Tube" or "Heparin Tube").

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `specimen_type_id` | UUID | NOT NULL, FK → `lab_specimen_types(id)` |
| `container_type_id` | UUID | NOT NULL, FK → `lab_container_types(id)` |
| `is_default` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |

**Unique:** `(specimen_type_id, container_type_id)`

### 3.5 Act Linkages

#### `reference.lab_act_analytes`
**Purpose:** Maps biology acts to the analytes they produce.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `global_act_id` | UUID | NOT NULL, FK → `global_actes(id)` |
| `analyte_id` | UUID | NOT NULL, FK → `lab_analytes(id)` |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 |
| `is_primary` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `is_required` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `display_group` | TEXT | |
| `notes` | TEXT | |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |

**Unique:** `(global_act_id, analyte_id)`

#### `reference.lab_act_contexts`
**Purpose:** Maps acts to their expected analyte contexts (i.e., which parameter measured with which specimen/unit/method).

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `global_act_id` | UUID | NOT NULL, FK → `global_actes(id)` |
| `analyte_context_id` | UUID | NOT NULL, FK → `lab_analyte_contexts(id)` |
| `sort_order` | INTEGER | |
| `is_required` | BOOLEAN | DEFAULT TRUE |
| `is_default` | BOOLEAN | DEFAULT FALSE |
| `display_group` | TEXT | |
| `actif` | BOOLEAN | DEFAULT TRUE |

#### `reference.lab_act_methods`
**Purpose:** Default analysis methods for biology acts.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `global_act_id` | UUID | NOT NULL, FK → `global_actes(id)` |
| `method_id` | UUID | NOT NULL, FK → `lab_methods(id)` |
| `is_default` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |

#### `reference.lab_act_specimen_containers`
**Purpose:** Maps acts to required specimen-container combinations with volume requirements.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `global_act_id` | UUID | NOT NULL, FK → `global_actes(id)` |
| `specimen_type_id` | UUID | NOT NULL, FK → `lab_specimen_types(id)` |
| `container_type_id` | UUID | NOT NULL, FK → `lab_container_types(id)` |
| `is_required` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `is_default` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `min_volume` | NUMERIC | |
| `volume_unit_id` | UUID | FK → `units(id)` |
| `volume_unit_label` | TEXT | |
| `collection_instructions` | TEXT | |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |

**Unique:** `(global_act_id, specimen_type_id, container_type_id)`

### 3.6 Reference Ranges & Interpretation

#### `reference.lab_methods`
**Purpose:** Laboratory analysis methods/methodologies.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `code` | TEXT | NOT NULL, UNIQUE |
| `libelle` | TEXT | NOT NULL |
| `description` | TEXT | |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |

#### `reference.lab_reference_profiles`
**Purpose:** Demographic-specific reference range profiles (by sex, age range).

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `analyte_context_id` | UUID | NOT NULL, FK → `lab_analyte_contexts(id)` |
| `sex` | TEXT | CHECK IN ('M','F','U') |
| `age_min_days` | INTEGER | |
| `age_max_days` | INTEGER | |
| `is_default` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 |
| `source` | TEXT | |
| `notes` | TEXT | |

#### `reference.lab_reference_rules`
**Purpose:** Interpretation rules for reference profiles. Supports numeric interval evaluation with PostgreSQL `EXCLUDE` constraint preventing overlapping ranges.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `profile_id` | UUID | NOT NULL, FK → `lab_reference_profiles(id)` ON DELETE CASCADE |
| `rule_type` | TEXT | NOT NULL, CHECK IN ('NUMERIC_INTERVAL','NUMERIC_THRESHOLD','CATEGORICAL','ORDINAL') |
| `interpretation` | TEXT | NOT NULL, CHECK IN ('NORMAL','ABNORMAL HIGH','ABNORMAL LOW','CAUTION HIGH','CAUTION LOW','CAUTION','ABNORMAL') |
| `priority` | INTEGER | NOT NULL DEFAULT 0 |
| `lower_numeric` | NUMERIC(18,6) | |
| `upper_numeric` | NUMERIC(18,6) | |
| `lower_inclusive` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `upper_inclusive` | BOOLEAN | NOT NULL DEFAULT TRUE |
| `display_text` | TEXT | |
| `reference_text` | TEXT | |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |

**EXCLUDE constraint:** Prevents overlapping numeric ranges within the same profile.

#### `reference.lab_canonical_allowed_values`
**Purpose:** Controlled vocabulary for categorical/choice-type results.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `code` | TEXT | NOT NULL, UNIQUE |
| `label` | TEXT | NOT NULL |
| `category` | TEXT | |
| `ordinal_rank` | INTEGER | |
| `actif` | BOOLEAN | NOT NULL DEFAULT TRUE |

---

## 4. Database Schema — Operational Tables

All operational tables live in the `public` schema. They track patient-specific lab orders, specimens, and results.

### 4.1 Lab Requests (Test Orders)

#### `public.lab_requests`
**Purpose:** One row per ordered test. Created either from a prescription (hospitalized flow) or directly via LIMS registration (walk-in flow).

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `tenant_patient_id` | UUID | NOT NULL, FK → `patients_tenant` |
| `admission_id` | UUID | NOT NULL, FK → `admissions(id)` |
| `global_act_id` | UUID | NOT NULL, FK → `reference.global_actes(id)` |
| `prescription_event_id` | UUID | **NULLABLE**, FK → `prescription_events(id)` |
| `created_by_user_id` | UUID | |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT now() |

**Key design:** `prescription_event_id` is nullable. For hospitalized patients, it links back to the prescription. For walk-in patients registered directly in the LIMS, it is NULL.

**Partial unique index:** `UNIQUE (prescription_event_id) WHERE prescription_event_id IS NOT NULL`

### 4.2 Specimen Lifecycle

#### `public.lab_collections`
**Purpose:** A collection event (venipuncture session). One collection can produce multiple specimens.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `tenant_patient_id` | UUID | NOT NULL |
| `admission_id` | UUID | |
| `collected_by_user_id` | UUID | NOT NULL |
| `collected_at` | TIMESTAMP | NOT NULL |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT now() |

#### `public.lab_specimens`
**Purpose:** A physical specimen (tube). Tracks status through its lifecycle: COLLECTED -> RECEIVED or REJECTED or INSUFFICIENT.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `lab_specimen_container_type_id` | UUID | NOT NULL (FK → `reference.lab_specimen_container_types`) |
| `barcode` | TEXT | UNIQUE |
| `status` | TEXT | NOT NULL DEFAULT 'COLLECTED', CHECK IN ('COLLECTED','RECEIVED','REJECTED','INSUFFICIENT') |
| `created_by_user_id` | UUID | NOT NULL |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT now() |
| `rejected_reason` | TEXT | |
| `received_at` | TIMESTAMP | |
| `received_by_user_id` | UUID | |
| `rejected_at` | TIMESTAMP | |
| `rejected_by_user_id` | UUID | |
| `last_status_changed_at` | TIMESTAMP | |
| `last_status_changed_by_user_id` | UUID | |

#### `public.lab_collection_specimens`
**Purpose:** M2M bridge — which specimens came from which collection event.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `lab_collection_id` | UUID | NOT NULL, FK → `lab_collections(id)` |
| `specimen_id` | UUID | NOT NULL, FK → `lab_specimens(id)` |

**Unique:** `(lab_collection_id, specimen_id)`

#### `public.lab_specimen_requests`
**Purpose:** M2M bridge — which lab requests are covered by which specimen. Multiple tests can share a single tube.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `specimen_id` | UUID | NOT NULL, FK → `lab_specimens(id)` |
| `lab_request_id` | UUID | NOT NULL, FK → `lab_requests(id)` |

**Unique:** `(specimen_id, lab_request_id)`

#### `public.lab_specimen_status_history`
**Purpose:** Full audit trail of every specimen status transition.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `specimen_id` | UUID | NOT NULL, FK → `lab_specimens(id)` |
| `old_status` | TEXT | |
| `new_status` | TEXT | NOT NULL |
| `changed_at` | TIMESTAMP | NOT NULL DEFAULT now() |
| `changed_by_user_id` | UUID | |
| `reason` | TEXT | |

#### `public.administration_event_lab_collections`
**Purpose:** Links the MAR (administration_events) to specimen collections. When a nurse collects a biology specimen via the Fiche de Surveillance, the administration event is linked to the lab collection.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `administration_event_id` | UUID | NOT NULL, FK → `administration_events(id)` |
| `lab_collection_id` | UUID | NOT NULL, FK → `lab_collections(id)` |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT now() |

**Unique:** `(administration_event_id, lab_collection_id)`

### 4.3 Patient Lab Reports (Results)

#### `public.patient_lab_reports`
**Purpose:** Container for lab results. Can originate from external uploads, internal LIMS, or HPRIM interface.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `tenant_patient_id` | UUID | NOT NULL, FK → `patients_tenant` |
| `admission_id` | UUID | FK → `admissions(id)` |
| `source_type` | TEXT | NOT NULL, CHECK IN ('EXTERNAL_REPORT','INTERNAL_LIMS','EXTERNAL_INTERFACE','LEGACY_MIGRATION') |
| `status` | TEXT | NOT NULL DEFAULT 'DRAFT', CHECK IN ('ACTIVE','ENTERED_IN_ERROR','DRAFT','VALIDATED','AMENDED') |
| `structuring_status` | TEXT | NOT NULL DEFAULT 'DOCUMENT_ONLY', CHECK IN ('DOCUMENT_ONLY','STRUCTURED') |
| `report_title` | TEXT | |
| `source_lab_name` | TEXT | |
| `source_lab_report_number` | TEXT | |
| `report_date` | DATE | |
| `collected_at` | TIMESTAMPTZ | |
| `received_at` | TIMESTAMPTZ | |
| `used_ai_assistance` | BOOLEAN | NOT NULL DEFAULT FALSE |
| `interpretation_text` | TEXT | |
| `uploaded_by_user_id` | UUID | NOT NULL, FK → `auth.users(user_id)` |
| `structured_by_user_id` | UUID | FK → `auth.users(user_id)` |
| `notes` | TEXT | |
| Entered-in-error fields | | `_by_user_id`, `_at`, `_reason` |

#### `public.patient_lab_report_tests`
**Purpose:** Individual tests within a report, linked to reference acts or panels.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `patient_lab_report_id` | UUID | NOT NULL, FK → `patient_lab_reports(id)` CASCADE |
| `global_act_id` | UUID | FK → `reference.global_actes(id)` |
| `panel_id` | UUID | FK → `reference.lab_panels(id)` |
| `raw_test_label` | TEXT | |
| `display_order` | INTEGER | NOT NULL DEFAULT 0 |
| `notes` | TEXT | |

#### `public.patient_lab_results`
**Purpose:** Atomic result values. Each row is one measured parameter from one test.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `patient_lab_report_id` | UUID | NOT NULL, FK → `patient_lab_reports(id)` CASCADE |
| `patient_lab_report_test_id` | UUID | FK → `patient_lab_report_tests(id)` SET NULL |
| `lab_analyte_context_id` | UUID | FK → `reference.lab_analyte_contexts(id)` |
| `analyte_id` | UUID | FK → `reference.lab_analytes(id)` |
| `raw_analyte_label` | TEXT | |
| `value_type` | TEXT | NOT NULL, CHECK IN ('NUMERIC','TEXT','BOOLEAN','CHOICE') |
| `numeric_value` | NUMERIC(18,6) | |
| `text_value` | TEXT | |
| `boolean_value` | BOOLEAN | |
| `choice_value` | TEXT | |
| `unit_id` | UUID | FK → `reference.units(id)` |
| `raw_unit_text` | TEXT | |
| `reference_range_text` | TEXT | |
| `reference_low_numeric` | NUMERIC(18,6) | |
| `reference_high_numeric` | NUMERIC(18,6) | |
| `raw_abnormal_flag_text` | TEXT | |
| `interpretation` | TEXT | CHECK IN ('NORMAL','LOW','HIGH','CRITICAL_LOW','CRITICAL_HIGH','BORDERLINE','ABNORMAL') |
| `reference_profile_id` | UUID | |
| `reference_rule_id` | UUID | |
| `observed_at` | TIMESTAMPTZ | |
| `method_id` | UUID | FK → `reference.lab_methods(id)` |
| `specimen_type_id` | UUID | FK → `reference.lab_specimen_types(id)` |
| `status` | TEXT | NOT NULL DEFAULT 'ACTIVE' |

**Constraint:** `lab_analyte_context_id IS NOT NULL OR raw_analyte_label IS NOT NULL` (at least one identity required)

#### `public.patient_lab_report_documents`
**Purpose:** PDFs and images attached to lab reports.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `patient_lab_report_id` | UUID | NOT NULL, FK → `patient_lab_reports(id)` CASCADE |
| `original_filename` | TEXT | NOT NULL |
| `storage_path` | TEXT | NOT NULL |
| `mime_type` | TEXT | |
| `file_size_bytes` | BIGINT | |
| `document_role` | TEXT | NOT NULL DEFAULT 'SOURCE', CHECK IN ('SOURCE','SUPPORTING','CORRECTED_EXPORT') |
| `derivation_type` | TEXT | NOT NULL DEFAULT 'ORIGINAL', CHECK IN ('ORIGINAL','MERGED') |

#### `public.admission_acts`
**Purpose:** Billing linkage — every lab request is also registered as an act on the admission for invoicing.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `admission_id` | UUID | NOT NULL, FK → `admissions(id)` |
| `global_act_id` | UUID | NOT NULL |
| `lab_request_id` | UUID | FK → `lab_requests(id)` SET NULL |
| `quantity` | NUMERIC | NOT NULL DEFAULT 1 |
| `entered_in_error_at` | TIMESTAMP | |
| `entered_in_error_by` | UUID | |
| `entered_in_error_reason` | TEXT | |
| `created_at` | TIMESTAMP | NOT NULL DEFAULT now() |

---

## 5. Database Schema — External Integration Tables

#### `public.external_systems`
**Purpose:** Registry of external systems (EVM middleware, HPRIM, etc.).

| Column | Type |
|---|---|
| `id` | UUID PK |
| `code` | TEXT NOT NULL UNIQUE |
| `label` | TEXT NOT NULL |
| `is_active` | BOOLEAN DEFAULT TRUE |

#### `public.global_act_external_codes`
**Purpose:** Maps internal acts to external system codes (e.g., internal "NFS" act → EVM code "1100").

| Column | Type |
|---|---|
| `id` | UUID PK |
| `global_act_id` | UUID NOT NULL FK → `reference.global_actes(id)` |
| `external_system_id` | UUID NOT NULL FK → `external_systems(id)` |
| `external_code` | TEXT NOT NULL |
| `is_active` | BOOLEAN |
| `valid_from`, `valid_to` | TIMESTAMP |

**Unique:** `(global_act_id, external_system_id, external_code)`

#### `public.lab_hprim_messages`
**Purpose:** Full audit trail of every HPRIM message sent (ORM) or received (ORU).

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `direction` | TEXT | NOT NULL, CHECK IN ('OUTBOUND','INBOUND') |
| `message_type` | TEXT | NOT NULL, CHECK IN ('ORM','ORU') |
| `file_name` | TEXT | NOT NULL, UNIQUE |
| `file_path` | TEXT | NOT NULL |
| `ok_file_name` | TEXT | |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING', CHECK IN ('PENDING','WRITTEN','PROCESSED','ERROR') |
| `payload_text` | TEXT | |
| `error_message` | TEXT | |
| `retry_count` | INTEGER | NOT NULL DEFAULT 0 |
| `max_retries` | INTEGER | NOT NULL DEFAULT 3 |
| `next_retry_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `processed_at` | TIMESTAMPTZ | |

#### `public.lab_hprim_links`
**Purpose:** Bridges internal lab_requests and lab_specimens to HPRIM order/sample IDs.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `hprim_message_id` | UUID | NOT NULL, FK → `lab_hprim_messages(id)` |
| `lab_request_id` | UUID | NOT NULL, FK → `lab_requests(id)` |
| `lab_specimen_id` | UUID | FK → `lab_specimens(id)` |
| `hprim_order_id` | TEXT | NOT NULL, UNIQUE |
| `hprim_sample_id` | TEXT | |
| `consumed_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

---

## 6. Database Schema — Shared Tables

These tables are used by the biology module but are not exclusive to it.

#### `reference.global_actes`
**Purpose:** Master catalog of medical acts (shared across all modules). Biology acts are identified by their `sous_famille` belonging to the "Biologie" family.

Key biology-specific columns:
- `lab_section_id` UUID FK → `lab_sections(id)`
- `lab_sub_section_id` UUID FK → `lab_sub_sections(id)`
- `is_panel` BOOLEAN NOT NULL DEFAULT FALSE
- `billing_mode` TEXT CHECK IN ('PANEL','DECOMPOSED')

#### `reference.units`
**Purpose:** Measurement units (g/L, mmol/L, mL, etc.). Used by analyte contexts and results.

Key columns: `id`, `code`, `display`, `is_ucum`, `is_active`

#### `reference.sih_sous_familles`
**Purpose:** Discipline hierarchy (parent of lab_sections). The "Biologie" sous-famille tree is the entry point for all lab classification.

#### `public.prescriptions`
**Purpose:** When `prescription_type = 'biology'`, the prescription is a biology order. The `acte_id` field references the global act being ordered.

#### `public.prescription_events`
**Purpose:** Scheduled time slots for biology prescriptions. Each event maps to one lab_request.

#### `public.administration_events`
**Purpose:** When biology collection is performed via the Fiche de Surveillance, an administration_event is created and linked to the lab_collection via `administration_event_lab_collections`.

---

## 7. Entity Relationship Model

```
reference.sih_sous_familles
    |
    +-- reference.lab_sections (1:N)
    |       +-- reference.lab_sub_sections (1:N)
    |
    +-- reference.lab_panels (1:N, via sous_famille_id)
    |       +-- reference.lab_panel_items (1:N, recursive)
    |       +-- FK → reference.global_actes (1:1 via global_act_id)
    |
    +-- reference.lab_analytes (1:N)
            +-- reference.lab_analyte_contexts (1:N)
            |       +-- reference.lab_reference_profiles (1:N)
            |       |       +-- reference.lab_reference_rules (1:N)
            |       +-- reference.lab_act_contexts (N:M with global_actes)
            |
            +-- reference.lab_analyte_units (1:N)
            +-- reference.lab_analyte_aliases (1:N)
            +-- reference.lab_act_analytes (N:M with global_actes)

reference.lab_specimen_types
    +-- reference.lab_specimen_container_types (M:N with container_types)
    +-- reference.lab_act_specimen_containers (N:M with global_actes + container_types)

reference.lab_container_types
    +-- reference.lab_specimen_container_types (M:N with specimen_types)

──────────────────────────────────────────────────────────

public.prescriptions (type='biology')
    +-- public.prescription_events (1:N)
    |       +-- public.lab_requests (1:1 per event, same transaction)
    |
    +-- (walk-in: lab_requests created with NULL prescription_event_id)

public.lab_requests
    +-- public.lab_specimen_requests (M:N bridge to specimens)
    +-- public.admission_acts (1:1 for billing)
    +-- public.lab_hprim_links (1:N for HPRIM tracking)

public.lab_collections
    +-- public.lab_collection_specimens (M:N bridge to specimens)
    +-- public.administration_event_lab_collections (M:N bridge to admin events)

public.lab_specimens
    +-- public.lab_collection_specimens (→ lab_collections)
    +-- public.lab_specimen_requests (→ lab_requests)
    +-- public.lab_specimen_status_history (1:N audit)
    +-- public.lab_hprim_links (1:N)

public.lab_hprim_messages
    +-- public.lab_hprim_links (1:N)
```

---

## 8. Backend Layer — Controllers, Services, Routes

### 8.1 LIMS Configuration

| Route | Method | Controller | Service Method |
|---|---|---|---|
| `/api/lims/analyte-contexts` | GET | `limsController.getAnalyteContexts` | `limsService.getAnalyteContexts` |
| `/api/lims/analyte-contexts` | POST | `limsController.createAnalyteContext` | `limsService.createAnalyteContext` |
| `/api/lims/analyte-contexts/:id` | PUT | `limsController.updateAnalyteContext` | `limsService.updateAnalyteContext` |
| `/api/lims/analyte-contexts/:id/status` | PATCH | `limsController.setContextStatus` | `limsService.setContextStatus` |
| `/api/lims/analyte-contexts/:id/reference-profiles` | GET | `limsController.getReferenceProfiles` | `limsService.getReferenceProfiles` |
| `/api/lims/analyte-contexts/:id/reference-profiles` | POST | `limsController.createReferenceProfile` | `limsService.createReferenceProfile` |
| `/api/lims/reference-profiles/:id` | PUT | `limsController.updateReferenceProfile` | `limsService.updateReferenceProfile` |
| `/api/lims/reference-profiles/:id/status` | PATCH | `limsController.setProfileStatus` | `limsService.setProfileStatus` |
| `/api/lims/reference-profiles/:id/rules` | GET | `limsController.getReferenceRules` | `limsService.getReferenceRules` |
| `/api/lims/reference-profiles/:id/rules` | POST | `limsController.createReferenceRule` | `limsService.createReferenceRule` |
| `/api/lims/reference-rules/:id` | PUT | `limsController.updateReferenceRule` | `limsService.updateReferenceRule` |
| `/api/lims/reference-rules/:id/status` | PATCH | `limsController.setRuleStatus` | `limsService.setRuleStatus` |
| `/api/lims/section-tree` | GET/POST | `limsController` | `limsService.getSectionTree / createSectionTree` |
| `/api/lims/sub-section-tree` | GET/POST | `limsController` | `limsService.getSubSectionTree / createSubSectionTree` |
| `/api/lims/biology-acts` | GET | `limsController.getBiologyActs` | `limsService.getBiologyActs` |
| `/api/lims/biology-acts/:id` | GET | `limsController.getBiologyActDetails` | `limsService.getBiologyActDetails` |
| `/api/lims/biology-acts/:id/contexts` | POST/DELETE | `limsController` | `limsService.assignActContext / unassignActContext` |
| `/api/lims/biology-acts/:id/specimen-containers` | POST/DELETE | `limsController` | `limsService.assignActSpecimenContainer / unassign...` |
| `/api/lims/biology-acts/:id/taxonomy` | PUT | `limsController` | `limsService.assignActTaxonomy` |
| `/api/lims/dictionaries/*` | GET | `limsController` | Various dictionary lookups |

### 8.2 LIMS Execution

| Route | Method | Controller | Service Method |
|---|---|---|---|
| `/api/lims/execution/patients/search` | GET | `limsExecutionController.searchPatient` | `limsExecutionService.searchUniversalPatient` |
| `/api/lims/execution/patients` | POST | `limsExecutionController.createPatient` | `limsExecutionService.createPatient` |
| `/api/lims/execution/patients/:id` | GET/PUT | `limsExecutionController` | `limsExecutionService.getPatient / updatePatient` |
| `/api/lims/execution/patients/:id/admissions` | GET | `limsExecutionController.getPatientAdmissions` | `limsExecutionService.getPatientAdmissions` |
| `/api/lims/execution/admissions` | POST | `limsExecutionController.createAdmission` | `limsExecutionService.createAdmission` |
| `/api/lims/execution/admissions/:id/walkin` | GET | `limsExecutionController.getActiveWalkinAdmission` | `limsExecutionService.getActiveWalkinAdmission` |
| `/api/lims/execution/lab-requests` | POST | `limsExecutionController.createLabRequests` | `limsExecutionService.createLabRequests` |
| `/api/lims/execution/collection-requirements/:admId` | GET | `limsExecutionController.getCollectionRequirements` | `limsExecutionService.getCollectionRequirements` |
| `/api/lims/execution/prelevement` | POST | `limsExecutionController.executePrelevement` | `limsExecutionService.executePrelevement` |
| `/api/lims/execution/collection-candidates/:eventId` | GET | `limsExecutionController.getCollectionCandidates` | `limsExecutionService.getCollectionCandidates` |
| `/api/lims/execution/collection-entry` | POST | `limsExecutionController.createCollectionEntry` | `limsExecutionService.createCollectionEntry` |
| `/api/lims/execution/specimens/:id/status` | PATCH | `limsExecutionController.updateSpecimenStatus` | `limsExecutionService.updateSpecimenStatus` |

### 8.3 LIMS Reception

| Route | Method | Controller | Service Method |
|---|---|---|---|
| `/api/lims/reception/specimens/:barcode` | GET | `limsReceptionController.getSpecimenByBarcode` | `limsReceptionService.getSpecimenByBarcode` |
| `/api/lims/reception/specimens/:id/receive` | POST | `limsReceptionController.receiveSpecimen` | `limsReceptionService.receiveSpecimen` |
| `/api/lims/reception/specimens/:id/reject` | POST | `limsReceptionController.rejectSpecimen` | `limsReceptionService.rejectSpecimen` |
| `/api/lims/reception/specimens/:id/insufficient` | POST | `limsReceptionController.markSpecimenInsufficient` | `limsReceptionService.markSpecimenInsufficient` |

### 8.4 Prescriptions (Biology Flow)

| Route | Method | Controller | Service Method |
|---|---|---|---|
| `/api/prescriptions` | POST | `prescriptionController.create` | `prescriptionService.createPrescription` |

**Biology-specific behavior inside `prescriptionService.createPrescription`:**
When `prescription_type = 'biology'`, after creating the prescription and its events, the service **in the same transaction** creates `lab_requests` rows linking each event to the `global_act_id`:

```sql
INSERT INTO lab_requests (id, tenant_patient_id, admission_id, global_act_id, prescription_event_id, created_by_user_id)
VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
```

### 8.5 HPRIM Integration

| File | Purpose |
|---|---|
| `hprimOutboundService.ts` | Generates ORM messages for specimens, writes `.hpr` files to `aller/` directory |
| `hprimInboundService.ts` | Polls `retour/` directory for ORU results, parses and persists results |
| `hprimSerializer.ts` | Serializes HPRIM ORM message payload from structured data |
| `hprimParser.ts` | Parses incoming HPRIM ORU messages into structured result data |
| `hprimMappingService.ts` | Resolves act→external code mappings, creates `lab_hprim_links` |
| `hprimFileService.ts` | Low-level file I/O for `.hpr` and `.ok` files |
| `hprimConfig.ts` | Directory paths and retry configuration |
| `hprimWorker.ts` | Background polling worker for inbound messages |

---

## 9. Frontend Layer — Components & API Client

### 9.1 LIMS Module Components

| Component | Path | Purpose |
|---|---|---|
| `LIMSLayout` | `/components/LIMS/LIMSLayout.tsx` | Sidebar navigation + Outlet |
| `LimsRegistrationPage` | `/components/LIMS/Registration/` | Walk-in patient registration & test ordering |
| `LimsCollectionPage` | `/components/LIMS/Collection/` | Walk-in specimen collection + barcode printing |
| `LimsReceptionPage` | `/components/LIMS/Reception/` | Barcode scan, QA actions (receive/reject/insufficient) |
| `LimsPatientListPage` | `/components/LIMS/Navigation/` | Patient search in LIMS context |
| `LimsPatientPage` | `/components/LIMS/Navigation/` | Patient profile with admission history |
| `LimsAdmissionPage` | `/components/LIMS/Navigation/` | Admission detail in LIMS mode |
| `AnalyteContextsPage` | `/components/LIMS/` | Configure analyte contexts + reference profiles + rules |
| `BiologyActsPage` | `/components/LIMS/` | Configure biology acts (link contexts, specimens, taxonomy) |
| `SectionTreePage` | `/components/LIMS/` | Manage chapter (section) classification |
| `SubSectionTreePage` | `/components/LIMS/` | Manage sub-chapter (sub-section) classification |

### 9.2 EMR-Integrated Components

| Component | Path | Purpose |
|---|---|---|
| `BiologyPrescriptionForm` | `/components/Prescription/` | Prescribe biology tests with scheduling |
| `FicheSurveillance` | `/components/PatientDossier/` | Bedside collection via surveillance flowsheet |
| `Biologie` | `/components/PatientDossier/` | View patient lab reports & results |
| `BiologyWorkspace` | `/components/PatientDossier/LabReports/` | Structured result viewing & editing |

### 9.3 API Methods

```typescript
// LIMS Configuration
api.limsConfig.getAnalyteContexts()
api.limsConfig.createAnalyteContext(data)
api.limsConfig.getBiologyActs()
api.limsConfig.getBiologyActDetails(id)
api.limsConfig.assignActContext(id, data)
api.limsConfig.assignActSpecimenContainer(id, data)
api.limsConfig.assignActTaxonomy(id, data)
api.limsConfig.getSectionTree() / createSectionTree()
api.limsConfig.getSubSectionTree() / createSubSectionTree()

// LIMS Execution
api.limsConfig.execution.searchUniversalPatient(query)
api.limsConfig.execution.getPatient(id)
api.limsConfig.execution.createAdmission(data)
api.limsConfig.execution.getActiveWalkinAdmission(patientId)
api.limsConfig.execution.createLabRequests(data)
api.limsConfig.execution.getCollectionRequirements(admissionId)
api.limsConfig.execution.executePrelevement(data)
api.limsConfig.execution.getCollectionCandidates(eventId)
api.limsConfig.execution.createCollectionEntry(data)

// LIMS Reception
api.getSpecimenByBarcode(barcode)
api.receiveSpecimen(specimenId)
api.rejectSpecimen(specimenId, reason)
api.markSpecimenInsufficient(specimenId)

// Patient Lab Reports
api.getPatientLabReports(patientId)
api.getPatientLabReportDetails(id)
api.createPatientLabReport(payload)
api.addLabReportTest(reportId, payload)
api.addLabReportResult(testId, payload)
```

---

## 10. Workflow A: Hospitalized Patient

This is the most complex flow. It starts in the medical dossier and crosses the boundary into the LIMS at reception.

### Step 1: Prescription Creation (Medical Dossier)

**Who:** Prescribing physician  
**Where:** Patient Dossier → Prescriptions tab → "Nouvelle Prescription" → Biology type  
**Frontend:** `BiologyPrescriptionForm.tsx`  
**API:** `POST /api/prescriptions`  
**Backend:** `prescriptionController.create` → `prescriptionService.createPrescription`

**What happens in the transaction:**
1. Creates a `prescriptions` row with `prescription_type = 'biology'` and `acte_id` referencing the global act
2. Creates `prescription_events` rows (one per scheduled time)
3. **For each event**, creates a `lab_requests` row linking `prescription_event_id` → `global_act_id`
4. Creates `admission_acts` rows for billing

**No HPRIM message is generated at this stage.**

### Step 2: Specimen Collection (Fiche de Surveillance)

**Who:** Nurse at bedside  
**Where:** Patient Dossier → Fiche de Surveillance → Biology prescription event → "Prélever"  
**Frontend:** `FicheSurveillance.tsx`  
**API:** `POST /api/lims/execution/collection-entry`  
**Backend:** `limsExecutionController.createCollectionEntry` → `limsExecutionService.createCollectionEntry`

**What happens in the transaction:**
1. Creates an `administration_events` row (recording that the nurse performed the collection)
2. Creates a `lab_collections` row
3. Creates `lab_specimens` rows (one per tube/container) with auto-generated barcodes, status = `COLLECTED`
4. Creates `lab_collection_specimens` bridges
5. Creates `lab_specimen_requests` bridges (linking specimens to lab_requests)
6. Creates `administration_event_lab_collections` bridge (linking admin event to collection)

**No HPRIM message is generated at this stage** (specimens are just collected, not yet received at the lab).

### Step 3: Specimen Reception (LIMS)

**Who:** Lab technician  
**Where:** LIMS → Réception → Scan barcode  
**Frontend:** `LimsReceptionPage.tsx`  
**API:** `GET /api/lims/reception/specimens/:barcode` → `POST /api/lims/reception/specimens/:id/receive`  
**Backend:** `limsReceptionController.receiveSpecimen` → `limsReceptionService.receiveSpecimen`

**What happens:**
1. Validates specimen exists and status is `COLLECTED`
2. Updates `lab_specimens` SET status = `RECEIVED`, received_at, received_by_user_id
3. Inserts `lab_specimen_status_history` row
4. **HPRIM ORM message is generated** (non-blocking, fire-and-forget)

**This is the HPRIM trigger point for hospitalized patients.**

### Step 4: Result Viewing (Medical Dossier)

**Who:** Physician  
**Where:** Patient Dossier → Biologie tab  
**Frontend:** `Biologie.tsx` → `BiologyWorkspace.tsx`  
**API:** `GET /api/patient-lab-reports/patient/:patientId`

Results appear here once the HPRIM ORU response is processed by the inbound worker.

---

## 11. Workflow B: Walk-In Patient

Walk-in patients are handled entirely within the LIMS module. There is no medical dossier involvement.

### Step 1: Registration (LIMS)

**Who:** Lab receptionist  
**Where:** LIMS → Enregistrement  
**Frontend:** `LimsRegistrationPage.tsx`  
**API:** `POST /api/lims/execution/lab-requests`  
**Backend:** `limsExecutionController.createLabRequests` → `limsExecutionService.createLabRequests`

**What happens in the transaction:**
1. If no active `LAB_WALKIN` admission exists, creates one (auto-close after 24h)
2. Creates `lab_requests` rows with `prescription_event_id = NULL` (no prescription link)
3. Creates `admission_acts` rows for billing

**No HPRIM message is generated at this stage.**

### Step 2: Specimen Collection (LIMS Prélèvement)

**Who:** Lab phlebotomist  
**Where:** LIMS → Prélèvement → Search patient → "Prélever & Imprimer"  
**Frontend:** `LimsCollectionPage.tsx`  
**API:** `GET /api/lims/execution/collection-requirements/:admId` → `POST /api/lims/execution/prelevement`  
**Backend:** `limsExecutionController.executePrelevement` → `limsExecutionService.executePrelevement`

**What happens in the transaction:**
1. Finds or creates a `lab_collections` row for the admission
2. Creates `lab_specimens` row with auto-generated barcode, status = `COLLECTED`
3. Creates `lab_collection_specimens` bridge
4. Links specimen to lab_requests via `lab_specimen_requests`

**HPRIM ORM message IS generated immediately after this step** (non-blocking, fire-and-forget).

**This is the HPRIM trigger point for walk-in patients** — because the lab phlebotomist is already in the lab, so collection and "reception" are effectively the same moment.

### Step 3: Barcode Label Printing

**Frontend:** `LimsCollectionPage.tsx` opens a print dialog
**Barcode format:** CODE128
**Label content:** Patient name, IPP, specimen type, container type, date/time, barcode string
**Label size:** 60mm x 40mm

---

## 12. HPRIM Integration — When Messages Are Generated

### ORM (Order Message) — Outbound

The HPRIM ORM message is the order sent to the external analyzer/middleware (e.g., EVM/Eurobio).

| Flow | Trigger Moment | Service Method | Trigger Location |
|---|---|---|---|
| **Walk-in** | After `executePrelevement()` — specimen created in the lab | `hprimOutboundService.generateOrmForSpecimen` | `limsExecutionService.executePrelevement` (line 517) |
| **Hospitalized** | After `receiveSpecimen()` — specimen scanned in at lab | `hprimOutboundService.generateOrmForSpecimen` | `limsReceptionService.receiveSpecimen` (line 101) |
| **Surveillance** | After `createCollectionEntry()` — nurse collects at bedside | `hprimOutboundService.generateOrmForSpecimens` | `limsExecutionService.createCollectionEntry` (line 450) |

**Important nuance for the Surveillance flow:** When a nurse collects specimens via the Fiche de Surveillance, the ORM is fired immediately after collection. However, when the specimen later arrives at the lab and is scanned at reception, **another ORM is fired** at that point. The system is designed to be idempotent — duplicate ORMs for the same specimen are handled gracefully by the external middleware.

### ORM Generation Process

When triggered, `hprimOutboundService.generateOrmForSpecimen(tenantId, specimenId)` does the following:

1. **Load specimen** + linked collection + patient info
2. **Load linked lab_requests** with act info from `reference.global_actes`
3. **Resolve EVM external codes** via `hprimMappingService.resolveActExternalCodes` — queries `global_act_external_codes` for acts mapped to the EVM external system
4. **Filter** to only acts that have EVM mappings (silently skips if none)
5. **Build HPRIM patient segment** (IPP, name, DOB, sex)
6. **Build OBR segments** (one per mapped act) with placer order ID and sample ID = barcode
7. **Serialize** via `hprimSerializer.serializeOrm()`
8. **Write** `.hpr` file to `aller/` directory + `.ok` trigger file
9. **Insert** `lab_hprim_messages` row (direction=OUTBOUND, type=ORM, status=WRITTEN)
10. **Insert** `lab_hprim_links` rows (one per OBR, linking lab_request + specimen to HPRIM order ID)

### ORU (Result Message) — Inbound

The HPRIM ORU message contains laboratory results from the external analyzer.

**Trigger:** `hprimWorker.ts` polls the `retour/` directory for new `.hpr` files.

**Processing:** `hprimInboundService` parses the ORU, resolves `hprim_order_id` → `lab_request_id` via `lab_hprim_links`, and persists results into `patient_lab_results` with appropriate `lab_analyte_context_id` resolution.

### File System Layout

```
{HPRIM_BASE_DIR}/
  +-- aller/          # Outbound: ORM files written here
  |     +-- ORM_{barcode}_{timestamp}.hpr
  |     +-- ORM_{barcode}_{timestamp}.hpr.ok
  |
  +-- retour/         # Inbound: ORU files deposited here by middleware
        +-- ORU_{id}_{timestamp}.hpr
        +-- ORU_{id}_{timestamp}.hpr.ok
```

### Summary: HPRIM Trigger Decision Tree

```
Is the patient hospitalized?
  |
  +-- YES (prescription flow)
  |     |
  |     Prescription created → lab_requests created (NO HPRIM)
  |     |
  |     Nurse collects at bedside → specimens created (HPRIM ORM fired*)
  |     |
  |     Specimens arrive at lab → technician scans → RECEIVED (HPRIM ORM fired)
  |
  +-- NO (walk-in flow)
        |
        Registration → lab_requests created (NO HPRIM)
        |
        Phlebotomist collects in lab → specimens created (HPRIM ORM fired)
        |
        (No separate reception step needed — collection IS reception for walk-ins)

* For the surveillance/bedside collection flow, ORM is fired at collection time.
  A second ORM may fire at reception. The external middleware handles deduplication.
```
