import Message from '../models/Message.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Notification from '../models/Notification.js';
import { getConversationRoom, getIO, emitNotification } from '../sockets/socketHandler.js';

// @desc    Get all conversations for logged-in user
// @route   GET /api/messages/conversations
// @access  Private
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Find all messages involving the user
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .sort({ createdAt: -1 })
      .populate('senderId', 'name avatar role email')
      .populate('receiverId', 'name avatar role email')
      .populate('jobId', 'title companyId');

    // Group messages by the partner user
    const conversationsMap = new Map();

    for (const msg of messages) {
      const isSender = msg.senderId._id.toString() === userId.toString();
      const partner = isSender ? msg.receiverId : msg.senderId;

      if (!partner) continue;

      const partnerId = partner._id.toString();

      if (!conversationsMap.has(partnerId)) {
        conversationsMap.set(partnerId, {
          partner,
          lastMessage: msg,
          unreadCount: 0,
          job: msg.jobId || null,
        });
      }

      if (!isSender && !msg.isRead) {
        conversationsMap.get(partnerId).unreadCount += 1;
      }
    }

    const conversations = Array.from(conversationsMap.values());

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

    const query = {
      $or: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    };

    if (jobId) {
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

    let attachmentUrl = '';
    let attachmentName = '';
    let attachmentSize = '';

    if (req.file) {
      attachmentUrl = `/uploads/${req.file.filename}`;
      attachmentName = req.file.originalname;
      const sizeInKb = Math.round(req.file.size / 1024);
      attachmentSize = sizeInKb > 1024 ? `${(sizeInKb / 1024).toFixed(1)} MB` : `${sizeInKb} KB`;
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
      .populate('jobId', 'title');

    // Trigger real-time broadcast via Socket.IO
    const io = getIO();
    if (io) {
      const room = getConversationRoom(senderId, receiverId, jobId);
      io.to(room).emit('new_message', populatedMsg);
      io.to(`user:${receiverId}`).emit('message_received', populatedMsg);
    }

    // Create notification
    const notif = await Notification.create({
      recipient: receiverId,
      sender: senderId,
      type: 'message',
      title: `Message from ${req.user.name}`,
      message: message.messageText.length > 50 ? `${message.messageText.slice(0, 50)}...` : message.messageText,
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

