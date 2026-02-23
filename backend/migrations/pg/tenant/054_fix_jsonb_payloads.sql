-- Migration 054: Fix JSONB Payloads for All Prescription Types
-- Renames: type → schedule_type, skippedDoses → skippedEvents, manualDoseAdjustments → manuallyAdjustedEvents
-- Strips medication-only fields from non-medication types
-- Idempotent: safe to run multiple times.

-- ============================================================================
-- 1. Rename 'type' → 'schedule_type' in details JSONB (all prescription types)
-- ============================================================================
UPDATE prescriptions
SET details = (details - 'type') || jsonb_build_object('schedule_type', details->'type')
WHERE details ? 'type'
  AND NOT (details ? 'schedule_type');

-- ============================================================================
-- 2. Rename skippedDoses → skippedEvents in schedule sub-object
-- ============================================================================
UPDATE prescriptions
SET details = jsonb_set(
    details,
    '{schedule}',
    ((details->'schedule') - 'skippedDoses') || jsonb_build_object('skippedEvents', details->'schedule'->'skippedDoses')
)
WHERE details->'schedule' ? 'skippedDoses'
  AND NOT (details->'schedule' ? 'skippedEvents');

-- ============================================================================
-- 3. Rename manualDoseAdjustments → manuallyAdjustedEvents in schedule sub-object
-- ============================================================================
UPDATE prescriptions
SET details = jsonb_set(
    details,
    '{schedule}',
    ((details->'schedule') - 'manualDoseAdjustments') || jsonb_build_object('manuallyAdjustedEvents', details->'schedule'->'manualDoseAdjustments')
)
WHERE details->'schedule' ? 'manualDoseAdjustments'
  AND NOT (details->'schedule' ? 'manuallyAdjustedEvents');

-- ============================================================================
-- 4. Strip medication-only fields from non-medication prescriptions
--    Exception: transfusion keeps qty, unit, adminDuration, route
-- ============================================================================

-- Biology, imagery, care, procedure: strip ALL medication fields
UPDATE prescriptions
SET details = details
    - 'molecule' - 'commercialName' - 'moleculeId' - 'productId'
    - 'unit' - 'route' - 'qty' - 'solvent'
    - 'adminMode' - 'adminDuration'
    - 'substitutable' - 'dilutionRequired' - 'databaseMode'
WHERE prescription_type IN ('biology', 'imagery', 'care', 'procedure');

-- Transfusion: strip only non-exception medication fields
UPDATE prescriptions
SET details = details
    - 'molecule' - 'commercialName' - 'moleculeId' - 'productId'
    - 'solvent'
    - 'adminMode'
    - 'substitutable' - 'dilutionRequired' - 'databaseMode'
WHERE prescription_type = 'transfusion';
