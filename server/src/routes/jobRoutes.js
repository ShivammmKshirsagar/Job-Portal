import express from 'express';
import { body } from 'express-validator';
import {
  getJobs,
  getFeaturedJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  toggleJobStatus,
  getEmployerJobs,
} from '../controllers/jobController.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { validateRequest } from '../middleware/validation.js';

const router = express.Router();

router.get('/', getJobs);
router.get('/featured', getFeaturedJobs);
router.get('/employer/my-jobs', protect, authorize('employer', 'admin'), getEmployerJobs);
router.get('/:id', optionalAuth, getJobById);

router.post(
  '/',
  protect,
  authorize('employer', 'admin'),
  [
    body('title').trim().notEmpty().withMessage('Job title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('location').notEmpty().withMessage('Location is required'),
    validateRequest,
  ],
  createJob
);

router.put('/:id', protect, authorize('employer', 'admin'), updateJob);
router.delete('/:id', protect, authorize('employer', 'admin'), deleteJob);
router.patch('/:id/status', protect, authorize('employer', 'admin'), toggleJobStatus);

export default router;

