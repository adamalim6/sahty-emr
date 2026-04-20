import { Router } from 'express';
import { pricingListController } from '../controllers/pricingListController';

const router = Router();

// --- PRICING LISTS ---
router.get('/', pricingListController.list);
router.post('/', pricingListController.create);
router.get('/search-actes', pricingListController.searchActes);
router.get('/available-organismes', pricingListController.listAvailableOrganismes);
router.get('/:id', pricingListController.getById);
router.put('/:id', pricingListController.update);
router.post('/:id/publish', pricingListController.publish);
router.post('/:id/archive', pricingListController.archive);
router.post('/:id/duplicate', pricingListController.duplicate);

// --- ITEMS ---
router.get('/:id/items', pricingListController.listItems);
router.post('/:id/items', pricingListController.addItem);
router.patch('/:id/items/:itemId/remove', pricingListController.removeItem);
router.patch('/:id/items/:itemId/reactivate', pricingListController.reactivateItem);

// --- ITEM VERSIONS ---
router.get('/:id/items/:itemId/versions', pricingListController.getItemVersions);
router.post('/:id/items/:itemId/versions', pricingListController.createItemVersion);
router.put('/item-versions/:versionId', pricingListController.updateDraftVersion);
router.post('/item-versions/:versionId/publish', pricingListController.publishItemVersion);

// --- ORGANISMES ---
router.get('/:id/organismes', pricingListController.listOrganismes);
router.post('/:id/organismes', pricingListController.assignOrganisme);
router.patch('/organisme-assignments/:assignmentId/remove', pricingListController.removeOrganisme);
router.patch('/organisme-assignments/:assignmentId/reactivate', pricingListController.reactivateOrganisme);

export default router;
