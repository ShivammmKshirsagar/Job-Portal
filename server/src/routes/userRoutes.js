import express from 'express';
import {
  updateProfile,
  uploadResume,
  getUserById,
  toggleSaveJob,
  getSavedJobs,
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.put('/profile', protect, updateProfile);
router.post('/resume', protect, upload.single('resume'), uploadResume);
router.get('/saved-jobs', protect, authorize('candidate'), getSavedJobs);
router.post('/saved-jobs/:jobId', protect, authorize('candidate'), toggleSaveJob);
router.get('/:id', getUserById);

export default router;

