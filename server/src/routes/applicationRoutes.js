import express from 'express';
import {
  applyToJob,
  getCandidateApplications,
  getJobApplications,
  updateApplicationStatus,
  withdrawApplication,
} from '../controllers/applicationController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.post(
  '/:jobId',
  protect,
  authorize('candidate'),
  upload.single('resume'),
  applyToJob
);

router.get(
  '/candidate/my-applications',
  protect,
  authorize('candidate'),
  getCandidateApplications
);

router.patch(
  '/:id/withdraw',
  protect,
  authorize('candidate'),
  withdrawApplication
);

router.post(
  '/:id/withdraw',
  protect,
  authorize('candidate'),
  withdrawApplication
);

router.get(
  '/job/:jobId',
  protect,
  authorize('employer', 'admin'),
  getJobApplications
);

router.patch(
  '/:id/status',
  protect,
  authorize('employer', 'admin'),
  updateApplicationStatus
);

export default router;

