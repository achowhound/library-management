import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, BookOpen, Bell, MessageSquare, LogOut } from 'lucide-react';

export default function ReaderLayout({ children, user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navLinks = [
    { to: '/', label: '首页', icon: Home },
    { to: '/search', label: '搜书', icon: Search },
    { to: '/history', label: '借阅记录', icon: BookOpen },
    { to: '/announcements', label: '公告通知', icon: Bell },
    { to: '/messages', label: '消息', icon: MessageSquare },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (onLogout) onLogout();
    navigate('/login');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📚</div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">图书馆管理系统</h1>
                <p className="text-sm text-gray-500">读者端</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                user?.role === 'ADMIN' ? 'bg-purple-100 text-purple-600' :
                user?.role === 'LIBRARIAN' ? 'bg-blue-100 text-blue-600' :
                'bg-green-100 text-green-600'
              }`}>
                {user?.role === 'ADMIN' ? '管理员' :
                 user?.role === 'LIBRARIAN' ? '馆员' :
                 '读者'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      location.pathname === to
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
              </nav>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm text-gray-500">{getGreeting()}</p>
                  <p className="font-semibold text-gray-800">{user?.name || '读者'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  退出
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
