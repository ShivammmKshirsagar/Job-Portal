import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import { openFile } from '../services/fileService';

const MessagingPage = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { showToast } = useNotification();

  const [conversations, setConversations] = useState([]);
  const [activePartner, setActivePartner] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'unread', 'archived'
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);

  // File attachment state
  const [attachmentFile, setAttachmentFile] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations on mount or URL change
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await api.get('/messages/conversations');
        let loadedConvs = [];
        if (res.data?.success) {
          loadedConvs = res.data.conversations || [];
        }

        const targetPartnerId = searchParams.get('partnerId');
        const targetJobId = searchParams.get('jobId');

        if (targetPartnerId) {
          // Check if conversation already exists in loaded list
          let match = loadedConvs.find(
            (c) =>
              c.partner?._id === targetPartnerId &&
              (!targetJobId || !c.job?._id || c.job._id === targetJobId)
          );

          if (!match) {
            match = loadedConvs.find((c) => c.partner?._id === targetPartnerId);
          }

          if (match) {
            setActivePartner(match.partner);
            setActiveJob(match.job || (targetJobId ? { _id: targetJobId } : null));
          } else {
            // Initiate or retrieve conversation from backend
            try {
              const initRes = await api.post('/messages/conversations/initiate', {
                partnerId: targetPartnerId,
                jobId: targetJobId || null,
              });

              if (initRes.data?.success && initRes.data.conversation) {
                const newConv = initRes.data.conversation;
                // Add to list if not duplicate
                const exists = loadedConvs.some(
                  (c) => c.partner?._id === newConv.partner?._id && c.job?._id === newConv.job?._id
                );
                if (!exists) {
                  loadedConvs = [newConv, ...loadedConvs];
                }
                setActivePartner(newConv.partner);
                setActiveJob(newConv.job);
              }
            } catch (initErr) {
              console.error('Failed to initiate conversation:', initErr);
              showToast({
                title: 'Conversation Notice',
                message: initErr.response?.data?.message || 'Unable to open conversation.',
                type: 'error',
              });
            }
          }
        } else if (loadedConvs.length > 0) {
          // Select first active non-archived conversation by default
          const firstNonArchived = loadedConvs.find((c) => !c.isArchived) || loadedConvs[0];
          setActivePartner(firstNonArchived.partner);
          setActiveJob(firstNonArchived.job);
        }

        setConversations(loadedConvs);
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [searchParams, showToast]);

  // Load message thread whenever activePartner changes
  useEffect(() => {
    if (!activePartner) return;

    const fetchMessages = async () => {
      try {
        const jobIdParam = activeJob?._id ? `?jobId=${activeJob._id}` : '';
        const res = await api.get(`/messages/${activePartner._id}${jobIdParam}`);
        if (res.data?.success) {
          setMessages(res.data.messages || []);
          if (res.data.partner && !activePartner.name) {
            setActivePartner(res.data.partner);
          }
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };

    fetchMessages();

    // Join conversation room in socket
    if (socket) {
      socket.emit('join_conversation', {
        partnerId: activePartner._id,
        jobId: activeJob?._id || null,
      });
    }

    return () => {
      if (socket) {
        socket.emit('leave_conversation', {
          partnerId: activePartner._id,
          jobId: activeJob?._id || null,
        });
      }
    };
  }, [activePartner, activeJob, socket]);

  // Listen to incoming messages and typing via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      // If message belongs to active thread
      if (
        activePartner &&
        (msg.senderId?._id === activePartner._id ||
          msg.senderId === activePartner._id ||
          msg.receiverId?._id === activePartner._id ||
          msg.receiverId === activePartner._id)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }

      // Update conversations list preview
      setConversations((prev) => {
        let found = false;
        const updated = prev.map((c) => {
          const isMatch =
            c.partner?._id === msg.senderId?._id ||
            c.partner?._id === msg.senderId ||
            c.partner?._id === msg.receiverId?._id ||
            c.partner?._id === msg.receiverId;

          if (isMatch) {
            found = true;
            const isSender = (msg.senderId?._id || msg.senderId) === user?._id;
            return {
              ...c,
              lastMessage: msg,
              lastMessageAt: msg.timestamp || msg.createdAt,
              unreadCount:
                !isSender && c.partner?._id !== activePartner?._id
                  ? (c.unreadCount || 0) + 1
                  : c.unreadCount,
            };
          }
          return c;
        });

        if (!found) {
          const isSender = (msg.senderId?._id || msg.senderId) === user?._id;
          const partner = isSender ? msg.receiverId : msg.senderId;
          return [
            {
              _id: msg._id,
              partner,
              job: msg.jobId || null,
              lastMessage: msg,
              lastMessageAt: msg.timestamp || msg.createdAt,
              unreadCount: isSender ? 0 : 1,
              isArchived: false,
              createdAt: msg.createdAt || new Date(),
              updatedAt: msg.updatedAt || new Date(),
            },
            ...updated,
          ];
        }

        return updated.sort(
          (a, b) =>
            new Date(b.lastMessageAt || b.createdAt || 0) -
            new Date(a.lastMessageAt || a.createdAt || 0)
        );
      });
    };

    const handleUserTyping = ({ userId, isTyping }) => {
      if (activePartner && userId === activePartner._id) {
        setPartnerTyping(isTyping);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_received', handleNewMessage);
    socket.on('user_typing', handleUserTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_received', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
    };
  }, [socket, activePartner, user?._id]);

  // Typing emitter
  const handleTyping = (e) => {
    setMessageText(e.target.value);
    if (!socket || !activePartner) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', {
        receiverId: activePartner._id,
        isTyping: true,
        jobId: activeJob?._id || null,
      });

      setTimeout(() => {
        setIsTyping(false);
        socket.emit('typing', {
          receiverId: activePartner._id,
          isTyping: false,
          jobId: activeJob?._id || null,
        });
      }, 2000);
    }
  };

  const updateConversationLastMessage = (sentMsg) => {
    setConversations((prev) =>
      prev.map((c) => {
        const isMatch =
          c.partner?._id === sentMsg.receiverId?._id ||
          c.partner?._id === sentMsg.receiverId;
        if (isMatch) {
          return {
            ...c,
            lastMessage: sentMsg,
            lastMessageAt: sentMsg.timestamp || new Date(),
          };
        }
        return c;
      })
    );
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!messageText.trim() && !attachmentFile) || !activePartner) return;

    try {
      if (attachmentFile) {
        // Send via REST multipart/form-data for file uploads
        const formData = new FormData();
        formData.append('receiverId', activePartner._id);
        if (activeJob?._id) formData.append('jobId', activeJob._id);
        if (messageText.trim()) formData.append('messageText', messageText.trim());
        formData.append('attachment', attachmentFile);

        const res = await api.post('/messages', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.data?.success) {
          setMessages((prev) => [...prev, res.data.message]);
          updateConversationLastMessage(res.data.message);
          setMessageText('');
          setAttachmentFile(null);
        }
      } else {
        // Send via Socket.IO
        if (socket && socket.connected) {
          socket.emit(
            'send_message',
            {
              receiverId: activePartner._id,
              jobId: activeJob?._id || null,
              messageText: messageText.trim(),
            },
            (response) => {
              if (response?.success) {
                setMessages((prev) => {
                  if (prev.some((m) => m._id === response.data._id)) return prev;
                  return [...prev, response.data];
                });
                updateConversationLastMessage(response.data);
              }
            }
          );
          setMessageText('');
        } else {
          // Fallback to REST
          const res = await api.post('/messages', {
            receiverId: activePartner._id,
            jobId: activeJob?._id || null,
            messageText: messageText.trim(),
          });
          if (res.data?.success) {
            setMessages((prev) => [...prev, res.data.message]);
            updateConversationLastMessage(res.data.message);
            setMessageText('');
          }
        }
      }
    } catch (err) {
      showToast({ title: 'Send Error', message: err.message, type: 'error' });
    }
  };

  // Toggle archive status for active conversation
  const handleToggleArchive = async () => {
    if (!activePartner) return;
    const currentConv = conversations.find((c) => c.partner?._id === activePartner._id);
    if (!currentConv?._id) return;

    try {
      const res = await api.patch(`/messages/conversations/${currentConv._id}/archive`);
      if (res.data?.success) {
        const updatedIsArchived = res.data.isArchived;
        setConversations((prev) =>
          prev.map((c) =>
            c._id === currentConv._id ? { ...c, isArchived: updatedIsArchived } : c
          )
        );
        showToast({
          title: updatedIsArchived ? 'Conversation Archived' : 'Conversation Restored',
          message: res.data.message,
          type: 'info',
        });
      }
    } catch (err) {
      showToast({ title: 'Error', message: err.message, type: 'error' });
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch = c.partner?.name
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());

    if (activeFilter === 'archived') {
      return matchesSearch && c.isArchived;
    }
    if (activeFilter === 'unread') {
      return matchesSearch && !c.isArchived && c.unreadCount > 0;
    }
    return matchesSearch && !c.isArchived;
  });

  const activeConversation = conversations.find(
    (c) => c.partner?._id === activePartner?._id
  );

  return (
    <div className="h-[calc(100vh-65px)] bg-slate-100 p-3 sm:p-6">
      {/* Split-Pane Container (Figure 8.9) */}
      <div className="mx-auto flex h-full max-w-7xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        {/* Left Sidebar: Conversations List */}
        <div
          className={`w-full sm:w-80 md:w-96 flex flex-col border-r border-slate-200 bg-white ${
            activePartner ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Messages</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {conversations.filter((c) => !c.isArchived).length} Active
              </span>
            </div>

            {/* Search Input */}
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="material-symbols-outlined text-[18px] text-slate-400">
                search
              </span>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Filter Tabs (Figure 8.9) */}
            <div className="mt-3 flex gap-2 text-xs font-semibold text-slate-500">
              {['all', 'unread', 'archived'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`rounded-lg px-3 py-1 capitalize transition ${
                    activeFilter === tab
                      ? 'bg-blue-600 text-white font-bold'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Loading conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <span className="material-symbols-outlined text-[32px] text-slate-300 block mb-1">
                  chat_bubble_outline
                </span>
                <p className="font-semibold text-slate-600">
                  {activeFilter === 'archived'
                    ? 'No archived conversations'
                    : activeFilter === 'unread'
                    ? 'No unread messages'
                    : 'No conversations yet'}
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                  {activeFilter === 'all' && (
                    user?.role === 'employer'
                      ? 'Select an applicant from your dashboard and click "Message" to connect.'
                      : 'Click "Message Employer" on any job or company page to reach out.'
                  )}
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = activePartner?._id === c.partner?._id;
                return (
                  <div
                    key={c._id || c.partner?._id}
                    onClick={() => {
                      setActivePartner(c.partner);
                      setActiveJob(c.job);
                      c.unreadCount = 0;
                    }}
                    className={`flex items-start gap-3 p-4 cursor-pointer transition ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Partner Avatar */}
                    <div className="relative shrink-0">
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 font-bold text-white text-sm overflow-hidden shadow-2xs">
                        {c.partner?.avatar ? (
                          <img
                            src={c.partner.avatar}
                            alt={c.partner.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          c.partner?.name?.charAt(0) || 'U'
                        )}
                      </div>
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white"></span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {c.partner?.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap ml-1">
                          {c.lastMessage
                            ? new Date(c.lastMessage.timestamp || c.lastMessage.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 truncate">
                        {c.partner?.title || (c.partner?.role === 'employer' ? 'Recruiter' : 'Candidate')}
                      </p>

                      <p className="mt-1 text-xs text-slate-600 truncate font-medium">
                        {c.lastMessage?.messageText || 'Conversation ready'}
                      </p>
                    </div>

                    {c.unreadCount > 0 && (
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-[10px] font-bold text-white shrink-0">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Chat Area */}
        <div
          className={`${
            activePartner ? 'flex' : 'hidden sm:flex'
          } flex-1 flex-col bg-slate-50`}
        >
          {activePartner ? (
            <>
              {/* Header (Figure 8.9) */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 py-3.5">
                <div className="flex items-center gap-3">
                  {/* Back button for mobile view */}
                  <button
                    type="button"
                    onClick={() => setActivePartner(null)}
                    className="sm:hidden -ml-1 mr-1 p-1 text-slate-400 hover:text-slate-700"
                    title="Back to conversations"
                  >
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                  </button>

                  <div className="relative">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 font-bold text-white text-sm overflow-hidden shadow-2xs">
                      {activePartner.avatar ? (
                        <img
                          src={activePartner.avatar}
                          alt={activePartner.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        activePartner.name?.charAt(0) || 'U'
                      )}
                    </div>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white"></span>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1">
                      {activePartner.name}
                      <span className="material-symbols-outlined text-[15px] text-blue-600">
                        verified
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {activePartner.title || (activePartner.role === 'employer' ? 'Hiring Lead' : 'Applicant')} •{' '}
                      <span className="text-emerald-600 font-semibold">Active Now</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    type="button"
                    onClick={handleToggleArchive}
                    className="rounded-lg p-2 hover:bg-slate-100 hover:text-slate-600 transition"
                    title={activeConversation?.isArchived ? 'Unarchive Conversation' : 'Archive Conversation'}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {activeConversation?.isArchived ? 'unarchive' : 'archive'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 hover:bg-slate-100 hover:text-slate-600 transition"
                    title="Voice Call (Coming Soon)"
                  >
                    <span className="material-symbols-outlined text-[20px]">phone</span>
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 hover:bg-slate-100 hover:text-slate-600 transition"
                    title="Video Meeting (Coming Soon)"
                  >
                    <span className="material-symbols-outlined text-[20px]">videocam</span>
                  </button>
                </div>
              </div>

              {/* REGARDING APPLICATION Header Card (Figure 8.9) */}
              {activeJob && (
                <div className="flex items-center justify-between border-b border-slate-200 bg-blue-50/70 px-4 sm:px-6 py-2.5 text-xs">
                  <div className="truncate mr-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                      Regarding Position
                    </span>
                    <Link
                      to={`/jobs/${activeJob._id}`}
                      className="ml-2 font-bold text-slate-900 hover:text-blue-700 hover:underline truncate inline-block max-w-[200px] sm:max-w-xs align-bottom"
                    >
                      {activeJob.title}
                    </Link>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                    {activeJob.location || 'Remote — India'}
                  </span>
                </div>
              )}

              {/* Message History */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                    <span className="material-symbols-outlined text-[36px] text-blue-300 block mb-1">
                      send
                    </span>
                    <p className="font-bold text-slate-700 text-sm">
                      Start your conversation with {activePartner.name}
                    </p>
                    <p className="text-slate-500 text-xs max-w-sm mx-auto">
                      Send a message or share documents directly. Messages are delivered in real time.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-center my-2">
                      <span className="rounded-full bg-slate-200/60 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Recent Messages
                      </span>
                    </div>

                    {messages.map((msg) => {
                      const isMine =
                        msg.senderId?._id === user?._id || msg.senderId === user?._id;

                      return (
                        <div
                          key={msg._id}
                          className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-md rounded-2xl p-4 text-xs shadow-xs leading-relaxed ${
                              isMine
                                ? 'bg-blue-600 text-white rounded-br-xs'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                            }`}
                          >
                            {msg.messageText && <p>{msg.messageText}</p>}

                            {/* File Attachment Card (Figure 8.9) */}
                            {msg.attachmentUrl && (
                              <div
                                className={`mt-2 flex items-center justify-between rounded-xl p-2.5 text-xs ${
                                  isMine
                                    ? 'bg-blue-700 text-white'
                                    : 'bg-slate-50 text-slate-800 border border-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate mr-2">
                                  <span className="material-symbols-outlined text-[20px] text-red-400">
                                    picture_as_pdf
                                  </span>
                                  <div className="truncate">
                                    <span className="font-bold block truncate">
                                      {msg.attachmentName || 'Document.pdf'}
                                    </span>
                                    <span className="text-[10px] opacity-75">
                                      {msg.attachmentSize || '1.2 MB'}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openFile(msg.attachmentUrl, {
                                      filename: msg.attachmentName || 'Attachment.pdf',
                                      download: true,
                                    })
                                  }
                                  className={`rounded-lg p-1.5 transition cursor-pointer border-0 bg-transparent text-inherit ${
                                    isMine ? 'hover:bg-blue-800' : 'hover:bg-slate-200'
                                  }`}
                                  title="Download attachment"
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    download
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>

                          <span className="text-[10px] text-slate-400 mt-1 px-1">
                            {new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Partner Typing Indicator */}
                {partnerTyping && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                    <span>{activePartner.name} is typing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Bar (Figure 8.9) */}
              <div className="border-t border-slate-200 bg-white p-4">
                {attachmentFile && (
                  <div className="mb-2 flex items-center justify-between rounded-xl bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
                    <span className="truncate">Attached: {attachmentFile.name}</span>
                    <button
                      onClick={() => setAttachmentFile(null)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setAttachmentFile(e.target.files[0])}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                    title="Attach File"
                  >
                    <span className="material-symbols-outlined text-[22px]">
                      attach_file
                    </span>
                  </button>

                  <input
                    type="text"
                    value={messageText}
                    onChange={handleTyping}
                    placeholder="Write a message..."
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                  />

                  <button
                    type="submit"
                    disabled={!messageText.trim() && !attachmentFile}
                    className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-300 hover:bg-blue-700 transition disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[20px]">send</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-blue-50 text-blue-600 mb-4">
                <span className="material-symbols-outlined text-[32px]">
                  {conversations.length === 0 ? 'mark_chat_unread' : 'chat'}
                </span>
              </div>
              <h3 className="font-bold text-slate-800 text-lg">
                {conversations.length === 0 ? 'No Active Conversations' : 'Select a conversation'}
              </h3>
              <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                {conversations.length === 0 ? (
                  user?.role === 'employer' ? (
                    'You can start conversations with candidates directly by visiting the applicants list for any of your job postings.'
                  ) : (
                    'Connect with hiring teams directly! Click "Message Employer" on any job posting or company page to reach out.'
                  )
                ) : (
                  'Choose a contact from the sidebar to view chat history and exchange messages.'
                )}
              </p>

              {conversations.length === 0 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {user?.role === 'employer' ? (
                    <>
                      <Link
                        to="/employer/dashboard"
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
                      >
                        View Applicants
                      </Link>
                      <Link
                        to="/employer/dashboard"
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                      >
                        Post a Job
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/jobs"
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
                      >
                        Browse Open Jobs
                      </Link>
                      <Link
                        to="/companies"
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                      >
                        Explore Companies
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingPage;
