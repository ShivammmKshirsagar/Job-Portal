import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Notification from '../models/Notification.js';
import { getConversationRoom, getIO, emitNotification } from '../sockets/socketHandler.js';
import { resolveEmployerForCompany } from './companyController.js';
import { persistUploadedFile } from '../utils/fileStorage.js';

// @desc    Initiate or retrieve an existing conversation with an employer or candidate
// @route   POST /api/messages/conversations/initiate
// @access  Private
export const initiateConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let { partnerId, jobId, companyId } = req.body;

    // If companyId provided without partnerId, resolve the employer account
    if (!partnerId && companyId) {
      const employer = await resolveEmployerForCompany(companyId);
      if (employer) {
        partnerId = employer._id;
      }
    }

    // If jobId provided and no partnerId, resolve job poster
    if (!partnerId && jobId) {
      const job = await Job.findById(jobId).select('_id postedBy companyId');
      if (job?.postedBy) {
        partnerId = job.postedBy;
      } else if (job?.companyId) {
        const employer = await resolveEmployerForCompany(job.companyId);
        if (employer) {
          partnerId = employer._id;
        }
      }
    }

    if (!partnerId) {
      return res.status(400).json({
        success: false,
        message: 'Could not resolve a valid recipient account for this conversation.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recipient identifier.',
      });
    }

    if (partnerId.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start a conversation with yourself.',
      });
    }

    // Verify partner exists and is active
    const partner = await User.findById(partnerId).select('_id name email avatar role title status');
    if (!partner || partner.status === 'banned') {
      return res.status(404).json({
        success: false,
        message: 'The requested recipient does not exist or has been suspended.',
      });
    }

    // Validate optional job reference
    let validJobId = null;
    if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
      const jobExists = await Job.findById(jobId).select('_id title companyId');
      if (jobExists) {
        validJobId = jobExists._id;
      }
    }

    // Look for existing conversation between these participants
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, partner._id] },
      ...(validJobId ? { jobId: validJobId } : {}),
    })
      .populate('participants', 'name email avatar role title')
      .populate('jobId', 'title companyId')
      .populate({
        path: 'lastMessage',
        populate: [
          { path: 'senderId', select: 'name avatar role' },
          { path: 'receiverId', select: 'name avatar role' },
        ],
      });

    // If specific job conversation wasn't found, check if a general conversation exists
    if (!conversation && !validJobId) {
      conversation = await Conversation.findOne({
        participants: { $all: [userId, partner._id] },
      })
        .populate('participants', 'name email avatar role title')
        .populate('jobId', 'title companyId')
        .populate({
          path: 'lastMessage',
          populate: [
            { path: 'senderId', select: 'name avatar role' },
            { path: 'receiverId', select: 'name avatar role' },
          ],
        });
    }

    // If conversation exists, unarchive if archived by current user
    if (conversation) {
      if (conversation.archivedBy?.some((id) => id.toString() === userId.toString())) {
        await Conversation.updateOne(
          { _id: conversation._id },
          { $pull: { archivedBy: userId } }
        );
      }
    } else {
      // Create new persistent Conversation document in MongoDB
      const createdConv = await Conversation.create({
        participants: [userId, partner._id],
        jobId: validJobId,
        lastMessage: null,
        lastMessageText: '',
        lastMessageAt: new Date(),
        archivedBy: [],
      });

      conversation = await Conversation.findById(createdConv._id)
        .populate('participants', 'name email avatar role title')
        .populate('jobId', 'title companyId');
    }

    // Count unread messages for this user in this conversation
    const unreadCount = await Message.countDocuments({
      senderId: partner._id,
      receiverId: userId,
      isRead: false,
      ...(validJobId ? { jobId: validJobId } : {}),
    });

    const isArchived = conversation.archivedBy?.some(
      (id) => id.toString() === userId.toString()
    ) || false;

    res.status(200).json({
      success: true,
      conversation: {
        _id: conversation._id,
        partner,
        job: conversation.jobId || null,
        lastMessage: conversation.lastMessage || null,
        lastMessageAt: conversation.lastMessageAt || conversation.updatedAt,
        unreadCount,
        isArchived,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all conversations for logged-in user
// @route   GET /api/messages/conversations
// @access  Private
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Fetch conversations stored in MongoDB where current user is a participant
    const dbConversations = await Conversation.find({ participants: userId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('participants', 'name avatar role email title')
      .populate('jobId', 'title companyId')
      .populate({
        path: 'lastMessage',
        populate: [
          { path: 'senderId', select: 'name avatar role' },
          { path: 'receiverId', select: 'name avatar role' },
        ],
      });

    // 2. Also retrieve messages to sync any legacy records and compute unread counts
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .sort({ createdAt: -1 })
      .populate('senderId', 'name avatar role email title')
      .populate('receiverId', 'name avatar role email title')
      .populate('jobId', 'title companyId');

    const conversationsMap = new Map();

    // Map existing database conversations
    for (const conv of dbConversations) {
      const partner = conv.participants.find(
        (p) => p && p._id.toString() !== userId.toString()
      );
      if (!partner) continue;

      const key = conv.jobId
        ? `${partner._id.toString()}:${conv.jobId._id.toString()}`
        : partner._id.toString();

      const unreadCount = await Message.countDocuments({
        senderId: partner._id,
        receiverId: userId,
        isRead: false,
        ...(conv.jobId ? { jobId: conv.jobId._id } : {}),
      });

      conversationsMap.set(key, {
        _id: conv._id,
        partner,
        job: conv.jobId || null,
        lastMessage: conv.lastMessage || null,
        lastMessageAt: conv.lastMessageAt || conv.updatedAt,
        unreadCount,
        isArchived: conv.archivedBy?.some((id) => id.toString() === userId.toString()) || false,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      });
    }

    // Ensure any legacy messages without a Conversation document are synced
    for (const msg of messages) {
      const isSender = msg.senderId._id.toString() === userId.toString();
      const partner = isSender ? msg.receiverId : msg.senderId;
      if (!partner) continue;

      const key = msg.jobId
        ? `${partner._id.toString()}:${msg.jobId._id.toString()}`
        : partner._id.toString();

      if (!conversationsMap.has(key)) {
        const newConv = await Conversation.create({
          participants: [userId, partner._id],
          jobId: msg.jobId?._id || null,
          lastMessage: msg._id,
          lastMessageText: msg.messageText || '',
          lastMessageAt: msg.timestamp || msg.createdAt,
        });

        conversationsMap.set(key, {
          _id: newConv._id,
          partner,
          job: msg.jobId || null,
          lastMessage: msg,
          lastMessageAt: msg.timestamp || msg.createdAt,
          unreadCount: !isSender && !msg.isRead ? 1 : 0,
          isArchived: false,
          createdAt: newConv.createdAt,
          updatedAt: newConv.updatedAt,
        });
      }
    }

    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt)
    );

    res.status(200).json({
      success: true,
      conversations,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get message thread between logged-in user and partner
// @route   GET /api/messages/:partnerId
// @access  Private
export const getMessages = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { partnerId } = req.params;
    const { jobId } = req.query;

    if (!partnerId || !mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid partner ID format.',
      });
    }

    const partner = await User.findById(partnerId).select(
      '_id name email avatar role title location status'
    );

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const query = {
      $or: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    };

    if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
      query.jobId = jobId;
    }

    const messages = await Message.find(query)
      .sort({ timestamp: 1 })
      .populate('senderId', 'name avatar role')
      .populate('receiverId', 'name avatar role')
      .populate('jobId', 'title');

    // Mark incoming messages as read
    await Message.updateMany(
      { senderId: partnerId, receiverId: userId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      partner,
      messages,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Send a message (REST API with optional file attachment)
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user._id;
    const { receiverId, jobId, messageText } = req.body;

    if (!receiverId || (!messageText && !req.file)) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message content or attachment are required.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid receiver ID.',
      });
    }

    if (receiverId.toString() === senderId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send message to yourself.',
      });
    }

    const receiver = await User.findById(receiverId).select('_id name role status');
    if (!receiver || receiver.status === 'banned') {
      return res.status(404).json({
        success: false,
        message: 'Recipient does not exist or has been suspended.',
      });
    }

    let attachmentUrl = '';
    let attachmentName = '';
    let attachmentSize = '';

    if (req.file) {
      attachmentUrl = `/uploads/${req.file.filename}`;
      attachmentName = req.file.originalname;
      const sizeInKb = Math.round(req.file.size / 1024);
      attachmentSize = sizeInKb > 1024 ? `${(sizeInKb / 1024).toFixed(1)} MB` : `${sizeInKb} KB`;
      // Persist attachment buffer to MongoDB
      await persistUploadedFile(req.file, senderId);
    }

    const message = await Message.create({
      senderId,
      receiverId,
      jobId: jobId || null,
      messageText: messageText || (req.file ? `Sent an attachment: ${attachmentName}` : ''),
      attachmentUrl,
      attachmentName,
      attachmentSize,
      timestamp: new Date(),
    });

    const populatedMsg = await Message.findById(message._id)
      .populate('senderId', 'name avatar role')
      .populate('receiverId', 'name avatar role')
      .populate('jobId', 'title companyId');

    // Update or create persistent Conversation document in MongoDB
    try {
      const existingConv = await Conversation.findOne({
        participants: { $all: [senderId, receiverId] },
        jobId: jobId || null,
      });

      if (existingConv) {
        existingConv.lastMessage = message._id;
        existingConv.lastMessageText = message.messageText;
        existingConv.lastMessageAt = message.timestamp;
        if (existingConv.archivedBy?.some((id) => id.toString() === senderId.toString())) {
          existingConv.archivedBy = existingConv.archivedBy.filter(
            (id) => id.toString() !== senderId.toString()
          );
        }
        await existingConv.save();
      } else {
        await Conversation.create({
          participants: [senderId, receiverId],
          jobId: jobId || null,
          lastMessage: message._id,
          lastMessageText: message.messageText,
          lastMessageAt: message.timestamp,
          archivedBy: [],
        });
      }
    } catch (convErr) {
      console.error('[Messages] Conversation update error:', convErr.message);
    }

    // Trigger real-time broadcast via Socket.IO
    const io = getIO();
    if (io) {
      const room = getConversationRoom(senderId, receiverId, jobId);
      io.to(room).emit('new_message', populatedMsg);
      io.to(`user:${receiverId}`).emit('message_received', populatedMsg);
    }

    // Create persistent notification
    const notif = await Notification.create({
      recipient: receiverId,
      sender: senderId,
      type: 'message',
      title: `Message from ${req.user.name}`,
      message:
        message.messageText.length > 50
          ? `${message.messageText.slice(0, 50)}...`
          : message.messageText,
      link: '/messages',
    });

    emitNotification(receiverId, notif);

    res.status(201).json({
      success: true,
      message: populatedMsg,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle archive status for a conversation
// @route   PATCH /api/messages/conversations/:id/archive
// @access  Private
export const toggleArchiveConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    const isArchived = conversation.archivedBy?.some(
      (id) => id.toString() === userId.toString()
    );

    if (isArchived) {
      conversation.archivedBy = conversation.archivedBy.filter(
        (id) => id.toString() !== userId.toString()
      );
    } else {
      if (!conversation.archivedBy) conversation.archivedBy = [];
      conversation.archivedBy.push(userId);
    }

    await conversation.save();

    res.status(200).json({
      success: true,
      isArchived: !isArchived,
      message: !isArchived ? 'Conversation archived.' : 'Conversation unarchived.',
    });
  } catch (err) {
    next(err);
  }
};
