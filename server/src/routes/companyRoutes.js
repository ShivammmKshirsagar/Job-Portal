import express from 'express';
import {
  getCompanies,
  getTopHiringCompanies,
  getCompanyById,
  updateCompanyProfile,
} from '../controllers/companyController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';

const router = express.Router();

router.get('/', getCompanies);
router.get('/top-hiring', getTopHiringCompanies);
router.get('/:id', getCompanyById);
router.put('/:id', protect, authorize('employer', 'admin'), updateCompanyProfile);

export default router;

