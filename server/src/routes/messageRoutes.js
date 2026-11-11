import express from 'express';
import {
  getConversations,
  initiateConversation,
  getMessages,
  sendMessage,
  toggleArchiveConversation,
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

router.get('/conversations', getConversations);
router.post('/conversations/initiate', initiateConversation);
router.patch('/conversations/:id/archive', toggleArchiveConversation);
router.get('/:partnerId', getMessages);
router.post('/', upload.single('attachment'), sendMessage);

export default router;
