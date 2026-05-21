import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReaderLayout from '../components/ReaderLayout';
import DueReminderBanner from '../components/DueReminderBanner';

function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        console.error('Failed to parse user data');
      }
    }
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  return (
    <ReaderLayout user={user}>
      <DueReminderBanner />

      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 mb-8 text-white">
        <h2 className="text-2xl font-bold mb-2">{getGreeting()}，{user?.name || '读者'}！</h2>
        <p className="opacity-90">欢迎回来，在这里您可以搜索和借阅图书。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div
          onClick={() => navigate('/search')}
          className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition cursor-pointer"
        >
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-xl font-bold mb-2">图书搜索</h2>
          <p className="text-gray-500 text-sm mb-4">搜索并浏览图书</p>
          <button className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
            进入 →
          </button>
        </div>

        <div
          onClick={() => navigate('/history')}
          className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition cursor-pointer"
        >
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-xl font-bold mb-2">借阅记录</h2>
          <p className="text-gray-500 text-sm mb-4">查看我的借阅历史</p>
          <button className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
            进入 →
          </button>
        </div>

        <div
          onClick={() => navigate('/announcements')}
          className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition cursor-pointer"
        >
          <div className="text-4xl mb-4">📢</div>
          <h2 className="text-xl font-bold mb-2">公告通知</h2>
          <p className="text-gray-500 text-sm mb-4">查看图书馆公告</p>
          <button className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
            进入 →
          </button>
        </div>

        <div
          onClick={() => navigate('/messages')}
          className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition cursor-pointer"
        >
          <div className="text-4xl mb-4">💬</div>
          <h2 className="text-xl font-bold mb-2">消息系统</h2>
          <p className="text-gray-500 text-sm mb-4">与图书馆工作人员沟通</p>
          <button className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
            进入 →
          </button>
        </div>
      </div>
    </ReaderLayout>
  );
}

export default HomePage;
