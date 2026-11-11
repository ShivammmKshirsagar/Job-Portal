import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';

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

  // Load conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await api.get('/messages/conversations');
        if (res.data.success) {
          setConversations(res.data.conversations);

          // Select first conversation by default or partner specified in URL
          const targetPartnerId = searchParams.get('partnerId');
          if (targetPartnerId) {
            const match = res.data.conversations.find(
              (c) => c.partner._id === targetPartnerId
            );
            if (match) {
              setActivePartner(match.partner);
              setActiveJob(match.job);
            }
          } else if (res.data.conversations.length > 0) {
            setActivePartner(res.data.conversations[0].partner);
            setActiveJob(res.data.conversations[0].job);
          }
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [searchParams]);

  // Load message thread whenever activePartner changes
  useEffect(() => {
    if (!activePartner) return;

    const fetchMessages = async () => {
      try {
        const jobIdParam = activeJob?._id ? `?jobId=${activeJob._id}` : '';
        const res = await api.get(`/messages/${activePartner._id}${jobIdParam}`);
        if (res.data.success) {
          setMessages(res.data.messages);
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
        (msg.senderId._id === activePartner._id || msg.receiverId._id === activePartner._id)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }

      // Update conversations list preview
      setConversations((prev) => {
        return prev.map((c) => {
          const isMatch =
            c.partner._id === msg.senderId._id || c.partner._id === msg.receiverId._id;
          if (isMatch) {
            return {
              ...c,
              lastMessage: msg,
              unreadCount:
                msg.senderId._id !== user._id && c.partner._id !== activePartner?._id
                  ? c.unreadCount + 1
                  : c.unreadCount,
            };
          }
          return c;
        });
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

        if (res.data.success) {
          setMessages((prev) => [...prev, res.data.message]);
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
          if (res.data.success) {
            setMessages((prev) => [...prev, res.data.message]);
            setMessageText('');
          }
        }
      }
    } catch (err) {
      showToast({ title: 'Send Error', message: err.message, type: 'error' });
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch = c.partner.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    if (activeFilter === 'unread') return matchesSearch && c.unreadCount > 0;
    return matchesSearch;
  });

  return (
    <div className="h-[calc(100vh-65px)] bg-slate-100 p-3 sm:p-6">
      {/* Split-Pane Container (Figure 8.9) */}
      <div className="mx-auto flex h-full max-w-7xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        {/* Left Sidebar: Conversations List */}
        <div className="w-full sm:w-80 md:w-96 flex flex-col border-r border-slate-200 bg-white">
          {/* Header */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Messages</h2>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {conversations.length} Active
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
              <div className="p-8 text-center text-xs text-slate-400">
                No active conversations found.
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = activePartner?._id === c.partner._id;
                return (
                  <div
                    key={c.partner._id}
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
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 font-bold text-white text-sm overflow-hidden">
                        {c.partner.avatar ? (
                          <img
                            src={c.partner.avatar}
                            alt={c.partner.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          c.partner.name?.charAt(0) || 'U'
                        )}
                      </div>
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white"></span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {c.partner.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap ml-1">
                          {c.lastMessage
                            ? new Date(c.lastMessage.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 truncate">
                        {c.partner.title || (c.partner.role === 'employer' ? 'Recruiter' : 'Candidate')}
                      </p>

                      <p className="mt-1 text-xs text-slate-600 truncate font-medium">
                        {c.lastMessage?.messageText || 'Conversation started'}
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
        <div className="hidden sm:flex flex-1 flex-col bg-slate-50">
          {activePartner ? (
            <>
              {/* Header (Figure 8.9) */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 font-bold text-white text-sm overflow-hidden">
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
                      {activePartner.title || 'Recruiter'} •{' '}
                      <span className="text-emerald-600 font-semibold">Active Now</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-slate-400">
                  <button className="rounded-lg p-2 hover:bg-slate-100 hover:text-slate-600">
                    <span className="material-symbols-outlined text-[20px]">phone</span>
                  </button>
                  <button className="rounded-lg p-2 hover:bg-slate-100 hover:text-slate-600">
                    <span className="material-symbols-outlined text-[20px]">videocam</span>
                  </button>
                  <button className="rounded-lg p-2 hover:bg-slate-100 hover:text-slate-600">
                    <span className="material-symbols-outlined text-[20px]">more_vert</span>
                  </button>
                </div>
              </div>

              {/* REGARDING APPLICATION Header Card (Figure 8.9) */}
              {activeJob && (
                <div className="flex items-center justify-between border-b border-slate-200 bg-blue-50/70 px-6 py-2.5 text-xs">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                      Regarding Application
                    </span>
                    <Link
                      to={`/jobs/${activeJob._id}`}
                      className="ml-2 font-bold text-slate-900 hover:text-blue-700 hover:underline"
                    >
                      {activeJob.title}
                    </Link>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    San Francisco, CA →
                  </span>
                </div>
              )}

              {/* Message History */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="text-center my-2">
                  <span className="rounded-full bg-slate-200/60 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Recent Messages
                  </span>
                </div>

                {messages.map((msg) => {
                  const isMine =
                    msg.senderId._id === user?._id || msg.senderId === user?._id;

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
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className={`rounded-lg p-1.5 transition ${
                                isMine ? 'hover:bg-blue-800' : 'hover:bg-slate-200'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                download
                              </span>
                            </a>
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 mt-1 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}

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
              <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-200/50 mb-3">
                <span className="material-symbols-outlined text-[28px]">chat</span>
              </div>
              <h3 className="font-bold text-slate-700 text-base">Select a conversation</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Choose a candidate or recruiter from the sidebar to start live chatting.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingPage;

