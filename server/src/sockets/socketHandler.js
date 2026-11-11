import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import { getJwtSecret } from '../config/jwt.js';

let ioInstance = null;
const onlineUsers = new Map(); // userId -> Set of socketIds

export const initSocket = (io) => {
  ioInstance = io;

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, getJwtSecret());

      const user = await User.findById(decoded.id).select('_id name email role avatar status');
      if (!user || user.status === 'banned') {
        return next(new Error('User unauthorized or suspended'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid socket authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();

    // Track online user sockets
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join dedicated user room for personal events & notifications
    socket.join(`user:${userId}`);

    console.log(`[Socket] User connected: ${socket.user.name} (${userId}) - socket: ${socket.id}`);

    // Join a specific conversation thread (with authorization check)
    socket.on('join_conversation', async ({ partnerId, jobId }, callback) => {
      try {
        if (!partnerId || !mongoose.Types.ObjectId.isValid(partnerId)) {
          if (callback) callback({ success: false, message: 'Valid partnerId is required.' });
          return;
        }

        if (partnerId.toString() === userId) {
          if (callback) callback({ success: false, message: 'Cannot join a conversation with oneself.' });
          return;
        }

        // Verify partner exists and is active
        const partner = await User.findById(partnerId).select('_id status role');
        if (!partner || partner.status === 'banned') {
          if (callback) callback({ success: false, message: 'Partner user not found or suspended.' });
          return;
        }

        // If jobId provided, verify authorization
        if (jobId) {
          if (!mongoose.Types.ObjectId.isValid(jobId)) {
            if (callback) callback({ success: false, message: 'Invalid jobId.' });
            return;
          }

          const job = await Job.findById(jobId).select('_id postedBy');
          if (!job) {
            if (callback) callback({ success: false, message: 'Referenced job does not exist.' });
            return;
          }

          const isUserAdmin = socket.user.role === 'admin';
          const isPartnerAdmin = partner.role === 'admin';
          const isUserPoster = job.postedBy.toString() === userId;
          const isPartnerPoster = job.postedBy.toString() === partnerId.toString();

          if (!isUserAdmin && !isPartnerAdmin && !isUserPoster && !isPartnerPoster) {
            if (callback) callback({ success: false, message: 'Neither user is authorized to manage applications for this job.' });
            return;
          }
        }

        const room = getConversationRoom(userId, partnerId, jobId);
        socket.join(room);
        console.log(`[Socket] Authorized: ${socket.user.name} joined room ${room}`);
        if (callback) callback({ success: true, room });
      } catch (err) {
        console.error('[Socket] join_conversation error:', err);
        if (callback) callback({ success: false, message: 'Internal authorization error.' });
      }
    });

    // Leave a conversation thread
    socket.on('leave_conversation', ({ partnerId, jobId }) => {
      if (partnerId && mongoose.Types.ObjectId.isValid(partnerId)) {
        const room = getConversationRoom(userId, partnerId, jobId);
        socket.leave(room);
      }
    });

    // Handle sending a message via socket (with strict sender identity and authorization checks)
    socket.on('send_message', async (data, callback) => {
      try {
        const { receiverId, jobId, messageText, attachmentUrl, attachmentName, attachmentSize } = data;

        if (!receiverId || !messageText || !messageText.trim()) {
          if (callback) callback({ success: false, message: 'Receiver and text required.' });
          return;
        }

        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
          if (callback) callback({ success: false, message: 'Invalid receiver ID format.' });
          return;
        }

        // Prevent sending to self
        if (receiverId.toString() === userId) {
          if (callback) callback({ success: false, message: 'Cannot send message to yourself.' });
          return;
        }

        // Verify receiver exists and is not banned
        const receiver = await User.findById(receiverId).select('_id name role status');
        if (!receiver || receiver.status === 'banned') {
          if (callback) callback({ success: false, message: 'Recipient user does not exist or has been suspended.' });
          return;
        }

        // If jobId provided, verify authorization
        if (jobId) {
          if (!mongoose.Types.ObjectId.isValid(jobId)) {
            if (callback) callback({ success: false, message: 'Invalid job ID format.' });
            return;
          }

          const job = await Job.findById(jobId).select('_id postedBy');
          if (!job) {
            if (callback) callback({ success: false, message: 'Referenced job not found.' });
            return;
          }

          const isUserAdmin = socket.user.role === 'admin';
          const isReceiverAdmin = receiver.role === 'admin';
          const isUserPoster = job.postedBy.toString() === userId;
          const isReceiverPoster = job.postedBy.toString() === receiverId.toString();

          if (!isUserAdmin && !isReceiverAdmin && !isUserPoster && !isReceiverPoster) {
            if (callback) callback({ success: false, message: 'Unauthorized: Message not permitted for this job context.' });
            return;
          }
        }

        // Strictly enforce senderId from authenticated socket (prevents client spoofing)
        const newMsg = await Message.create({
          senderId: userId,
          receiverId,
          jobId: jobId || null,
          messageText: messageText.trim(),
          attachmentUrl: attachmentUrl || '',
          attachmentName: attachmentName || '',
          attachmentSize: attachmentSize || '',
          timestamp: new Date(),
        });

        const populatedMsg = await Message.findById(newMsg._id)
          .populate('senderId', 'name avatar role')
          .populate('receiverId', 'name avatar role')
          .populate('jobId', 'title companyId');

        const room = getConversationRoom(userId, receiverId, jobId);

        // Broadcast to conversation room
        io.to(room).emit('new_message', populatedMsg);

        // Also notify receiver's personal user room
        io.to(`user:${receiverId}`).emit('message_received', populatedMsg);

        // Create persistent in-app notification for receiver
        const notif = await Notification.create({
          recipient: receiverId,
          sender: userId,
          type: 'message',
          title: `New message from ${socket.user.name}`,
          message: messageText.trim().length > 50 ? `${messageText.trim().slice(0, 50)}...` : messageText.trim(),
          link: '/messages',
        });

        io.to(`user:${receiverId}`).emit('notification', notif);

        if (callback) callback({ success: true, data: populatedMsg });
      } catch (err) {
        console.error('[Socket] Error in send_message:', err);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // Typing indicator (with partner validation)
    socket.on('typing', ({ receiverId, isTyping, jobId }) => {
      if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) return;
      const room = getConversationRoom(userId, receiverId, jobId);
      socket.to(room).emit('user_typing', {
        userId,
        userName: socket.user.name,
        isTyping: !!isTyping,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.user.name} (${socket.id})`);
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
        }
      }
    });
  });
};

// Deterministic conversation room helper
export const getConversationRoom = (user1, user2, jobId = null) => {
  const sorted = [user1.toString(), user2.toString()].sort();
  return jobId ? `conv:${sorted[0]}:${sorted[1]}:${jobId}` : `conv:${sorted[0]}:${sorted[1]}`;
};

// Helper to push real-time notification to a user
export const emitNotification = (recipientId, notification) => {
  if (ioInstance) {
    ioInstance.to(`user:${recipientId.toString()}`).emit('notification', notification);
  }
};

export const getIO = () => ioInstance;
