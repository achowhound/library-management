import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import ReaderLayout from '../components/ReaderLayout';
import { MessageSquare, Send, User, Clock, X } from 'lucide-react';

const Messages = () => {
  const { user, apiRequest, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [staff, setStaff] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/messages/conversations');
      setConversations(data);
      setError(null);
    } catch (err) {
      setError(err.message || '获取消息列表失败');
      console.error('获取消息列表错误:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      setLoading(true);
      const data = await apiRequest(`/messages/conversation/${userId}`);
      setMessages(data);
      setError(null);
    } catch (err) {
      setError(err.message || '获取聊天记录失败');
      console.error('获取聊天记录错误:', err);
    } finally {
      setLoading(false);
      fetchUnreadCounts();
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const data = await apiRequest('/messages/unread');
      setUnreadCounts(data);
    } catch (err) {
      console.error('获取未读消息数量错误:', err);
    }
  };

  const handleConversationSelect = (conversation) => {
    setSelectedConversation(conversation);
    setUnreadCounts((prev) => ({
      ...prev,
      [conversation.userId]: 0,
    }));
    fetchMessages(conversation.userId);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const message = await apiRequest('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: selectedConversation.userId,
          content: newMessage
        })
      });

      setMessages(prev => [...prev, message]);
      setNewMessage('');
      fetchConversations();
      fetchUnreadCounts();
    } catch (err) {
      setError(err.message || '发送消息失败');
      console.error('发送消息错误:', err);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await apiRequest(`/messages/${messageId}`, {
        method: 'DELETE'
      });

      setMessages(prev => prev.filter(message => message.id !== messageId));
      fetchConversations();
      fetchUnreadCounts();
    } catch (err) {
      setError(err.message || '删除消息失败');
      console.error('删除消息错误:', err);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const fetchStaff = async () => {
    try {
      const data = await apiRequest('/messages/staff');
      setStaff(data);
    } catch (err) {
      console.error('获取工作人员列表错误:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchConversations();
      fetchStaff();
      fetchUnreadCounts();
    }
  }, [isAuthenticated, apiRequest, user]);

  const staffConversationList = useMemo(() => {
    return staff.map((member) => {
      const existingConversation = conversations.find((conversation) => conversation.userId === member.id);

      return {
        userId: member.id,
        userName: member.name,
        userRole: member.role || 'LIBRARIAN',
        unreadCount: unreadCounts[member.id] || 0,
        lastMessage: existingConversation?.lastMessage || null,
      };
    });
  }, [staff, conversations, unreadCounts]);

  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  useEffect(() => {
    if (!selectedConversation && staffConversationList.length > 0) {
      handleConversationSelect(staffConversationList[0]);
    }
  }, [staffConversationList, selectedConversation]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">请先登录</h3>
            <p className="text-gray-500 mt-2">登录后才能使用消息系统</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReaderLayout user={user}>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <MessageSquare className="h-6 w-6" />
        消息
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
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 h-[600px] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-lg">消息列表</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center h-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">图书馆工作人员</h3>
                  {staffConversationList.length === 0 ? (
                    <div className="text-sm text-gray-400 p-3">暂无可联系的图书管理员</div>
                  ) : (
                    staffConversationList.map((conversation) => (
                      <div
                        key={conversation.userId}
                        onClick={() => handleConversationSelect(conversation)}
                        className={`cursor-pointer p-3 rounded-lg mb-2 transition-colors hover:bg-gray-100 ${
                          selectedConversation?.userId === conversation.userId
                            ? 'bg-blue-50 border-l-4 border-primary'
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
                            {conversation.lastMessage?.content || '点击开始与该管理员聊天'}
                          </p>
                          {conversation.lastMessage?.createdAt ? (
                            <p>{formatTime(conversation.lastMessage.createdAt)}</p>
                          ) : (
                            <p>-</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {selectedConversation ? (
            <div className="bg-white rounded-lg border border-gray-200 h-[600px] flex flex-col">
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

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {loading ? (
                  <div className="flex items-center justify-center h-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <MessageSquare className="h-10 w-10 mb-2" />
                    <p>暂无聊天记录</p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => {
                      const isSent = message.senderId === user.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-4`}
                        >
                          <div
                            className={`max-w-[70%] p-3 rounded-lg shadow-sm ${
                              isSent
                                ? 'bg-primary text-black rounded-br-none rounded-tl-lg'
                                : 'bg-gray-200 text-black rounded-bl-none rounded-tr-lg'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <p className="text-sm mb-1 font-medium">{message.content || '无内容'}</p>
                              {isSent && (
                                <button
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            <div className={`flex items-center gap-1 mt-1 text-xs ${isSent ? 'text-blue-200' : 'text-gray-500'}`}>
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

              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="输入消息..."
                    className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-primary text-white rounded-full p-2 hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
    </ReaderLayout>
  );
};

export default Messages;
