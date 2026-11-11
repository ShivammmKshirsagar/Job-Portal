import express from 'express';
import {
  updateProfile,
  uploadResume,
  getUserById,
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.put('/profile', protect, updateProfile);
router.post('/resume', protect, upload.single('resume'), uploadResume);
router.get('/:id', getUserById);

export default router;

