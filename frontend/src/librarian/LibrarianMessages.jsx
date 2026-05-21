import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Send, User, Clock, X } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');  // 改为统一 token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || data.message || '请求失败');
  }
  return data;
}



export default function LibrarianMessages() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations]);

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0);
  }, [conversations]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await request('/messages/conversations');
      setConversations(data);
      setError('');
      fetchUnreadCounts(); // 更新未读消息数量
    } catch (err) {
      setError(err.message || '加载会话失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const data = await request('/messages/unread');
      setUnreadCounts(data);
    } catch (err) {
      console.error('获取未读消息数量错误:', err);
    }
  };

  const loadMessages = async (otherUserId) => {
    try {
      setLoading(true);
      const data = await request(`/messages/conversation/${otherUserId}`);
      setMessages(data);
      setError('');
    } catch (err) {
      setError(err.message || '加载消息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setUnreadCounts((prev) => ({
      ...prev,
      [conversation.userId]: 0,
    }));
    loadMessages(conversation.userId);
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return;
    try {
      setSending(true);
      const created = await request('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: selectedConversation.userId,
          content: newMessage.trim(),
        }),
      });
      setMessages((prev) => [...prev, created]);
      setNewMessage('');
      await loadConversations();
      fetchUnreadCounts(); // 更新未读消息数量
    } catch (err) {
      setError(err.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await request(`/messages/${messageId}`, {
        method: 'DELETE'
      });

      // 从本地消息列表中移除删除的消息
      setMessages(prev => prev.filter(message => message.id !== messageId));
      await loadConversations(); // 更新会话列表
      fetchUnreadCounts(); // 更新未读消息数量
    } catch (err) {
      setError(err.message || '删除消息失败');
      console.error('删除消息错误:', err);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    // 获取当前登录用户的ID
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUserId(user.id);
      } catch (e) {
        console.error('Failed to parse user data');
      }
    }
    
    loadConversations();
    fetchUnreadCounts();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      loadConversations();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedConversation && sortedConversations.length > 0) {
      handleSelectConversation(sortedConversations[0]);
    }
  }, [selectedConversation, sortedConversations]);

  useEffect(() => {
    if (!selectedConversation) {
      return;
    }

    const latestConversation = sortedConversations.find(
      (conversation) => conversation.userId === selectedConversation.userId
    );

    if (
      latestConversation?.lastMessage?.id &&
      latestConversation.lastMessage.id !== messages[messages.length - 1]?.id
    ) {
      loadMessages(selectedConversation.userId);
    }
  }, [sortedConversations, selectedConversation, messages]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          消息系统
          {totalUnreadCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              未读 {totalUnreadCount}
            </span>
          )}
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 消息列表 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 h-[600px] flex flex-col">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-lg">读者会话</h2>
                <button
                  onClick={loadConversations}
                  className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  刷新
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                {loading && sortedConversations.length === 0 ? (
                  <div className="flex items-center justify-center h-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : sortedConversations.length === 0 ? (
                  <div className="text-sm text-gray-400 p-3">暂无读者会话</div>
                ) : (
                  <div>
                    {sortedConversations.map((conversation) => (
                      <div
                        key={conversation.userId}
                        onClick={() => handleSelectConversation(conversation)}
                        className={`cursor-pointer p-3 rounded-lg mb-2 transition-colors hover:bg-gray-100 ${
                          selectedConversation?.userId === conversation.userId
                            ? 'bg-blue-50 border-l-4 border-blue-500'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="h-4 w-4 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{conversation.userName}</p>
                              <p className="text-xs text-gray-500">{conversation.userRole}</p>
                            </div>
                          </div>
                          {conversation.unreadCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <p className="truncate max-w-[180px]">
                            {conversation.lastMessage?.content || '点击查看会话'}
                          </p>
                          {conversation.lastMessage?.createdAt ? (
                            <p>{formatTime(conversation.lastMessage.createdAt)}</p>
                          ) : (
                            <p>-</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 聊天界面 */}
          <div className="lg:col-span-3">
            {selectedConversation ? (
              <div className="bg-white rounded-lg border border-gray-200 h-[600px] flex flex-col">
                {/* 聊天头部 */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{selectedConversation.userName}</h3>
                      <p className="text-xs text-gray-500">{selectedConversation.userRole}</p>
                    </div>
                  </div>
                </div>

                {/* 消息列表 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {loading && messages.length === 0 ? (
                    <div className="flex items-center justify-center h-20">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                      <MessageSquare className="h-10 w-10 mb-2" />
                      <p>暂无聊天记录</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((message) => {
                        const isSentByMe = message.senderId === currentUserId;
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} mb-4`}
                          >
                            <div
                              className={`max-w-[70%] p-3 rounded-lg shadow-sm ${
                                isSentByMe
                                  ? 'bg-blue-500 text-white rounded-br-none rounded-tl-lg'
                                  : 'bg-gray-200 text-black rounded-bl-none rounded-tr-lg'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <p className="text-sm mb-1 font-medium break-words">{message.content}</p>
                                {isSentByMe && (
                                  <button
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="text-blue-200 hover:text-red-300 transition-colors ml-2"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <div className={`flex items-center gap-1 mt-1 text-xs ${isSentByMe ? 'text-blue-100' : 'text-gray-500'}`}>
                                <Clock className="h-3 w-3" />
                                <span>{formatTime(message.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* 消息输入框 */}
                <div className="p-4 border-t border-gray-200">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendMessage();
                      }}
                      placeholder="输入回复内容..."
                      className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="bg-blue-500 text-white rounded-full p-2 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 h-[600px] flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <MessageSquare className="mx-auto h-12 w-12 mb-4" />
                  <h3 className="text-lg font-medium">选择一个会话</h3>
                  <p className="mt-2">从左侧列表中选择一个会话开始聊天</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
