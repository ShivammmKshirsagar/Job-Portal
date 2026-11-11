import express from 'express';
import {
  getAdminStats,
  getAdminUsers,
  updateUserStatus,
  getAdminCompanies,
  updateCompanyStatus,
  getTaxonomy,
  addTaxonomy,
  deleteTaxonomy,
} from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';

const router = express.Router();

router.get('/taxonomy', getTaxonomy);

// All routes below require Admin role
router.use(protect, authorize('admin'));

router.get('/stats', getAdminStats);
router.get('/users', getAdminUsers);
router.patch('/users/:id/status', updateUserStatus);

router.get('/companies', getAdminCompanies);
router.patch('/companies/:id/status', updateCompanyStatus);

router.post('/taxonomy', addTaxonomy);
router.delete('/taxonomy/:id', deleteTaxonomy);

export default router;

