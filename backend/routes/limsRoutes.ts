import { Router } from 'express';
import { limsController } from '../controllers/lims/limsController';

const router = Router();

// === PARAMÈTRES (CONTEXTS) ===
router.get('/analyte-contexts', limsController.getAnalyteContexts);
router.post('/analyte-contexts', limsController.createAnalyteContext);
router.put('/analyte-contexts/:id', limsController.updateAnalyteContext);
router.patch('/analyte-contexts/:id/status', limsController.setContextStatus);

router.get('/analyte-contexts/:id/reference-profiles', limsController.getReferenceProfiles);
router.post('/analyte-contexts/:id/reference-profiles', limsController.createReferenceProfile);
router.put('/reference-profiles/:id', limsController.updateReferenceProfile);
router.patch('/reference-profiles/:id/status', limsController.setProfileStatus);

router.get('/reference-profiles/:id/rules', limsController.getReferenceRules);
router.post('/reference-profiles/:id/rules', limsController.createReferenceRule);
router.put('/reference-rules/:id', limsController.updateReferenceRule);
router.patch('/reference-rules/:id/status', limsController.setRuleStatus);

// === CHAPITRES ===
router.get('/section-tree', limsController.getSectionTree);
router.post('/section-tree', limsController.createSectionTree);
router.put('/section-tree/:id', limsController.updateSectionTree);
router.patch('/section-tree/:id/status', limsController.setSectionTreeStatus);

router.get('/sub-section-tree', limsController.getSubSectionTree);
router.post('/sub-section-tree', limsController.createSubSectionTree);
router.put('/sub-section-tree/:id', limsController.updateSubSectionTree);
router.patch('/sub-section-tree/:id/status', limsController.setSubSectionTreeStatus);

// === ACTES BIOLOGIQUES ===
router.get('/biology-acts', limsController.getBiologyActs);
router.get('/biology-acts/:id', limsController.getBiologyActDetails);

router.post('/biology-acts/:id/analyte-contexts', limsController.assignActContext);
router.delete('/biology-acts/:id/analyte-contexts/:assignmentId', limsController.unassignActContext);

router.post('/biology-acts/:id/specimen-containers', limsController.assignActSpecimenContainer);
router.patch('/biology-acts/:id/specimen-containers/:containerId/default', limsController.setActSpecimenContainerDefault);
router.delete('/biology-acts/:id/specimen-containers/:assignmentId', limsController.unassignActSpecimenContainer);

router.put('/biology-acts/:id/taxonomy', limsController.assignActTaxonomy);

// === DICTIONARIES ===
router.get('/dictionaries/sous-familles', limsController.getSousFamilles);
router.get('/dictionaries/sections', limsController.getSections);
router.get('/dictionaries/sub-sections', limsController.getSubSections);
router.get('/dictionaries/analytes', limsController.getAnalytes);
router.get('/dictionaries/methods', limsController.getMethods);
router.get('/dictionaries/specimens', limsController.getSpecimenTypes);
router.get('/dictionaries/containers', limsController.getContainers);
router.get('/dictionaries/units', limsController.getUnits);
router.get('/canonical-values', limsController.getCanonicalValues);

export default router;
