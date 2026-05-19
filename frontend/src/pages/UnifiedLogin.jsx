import { useState, useEffect } from 'react';

const UnifiedLogin = () => {
  const [role, setRole] = useState('reader');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [bannedInfo, setBannedInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    if (role === 'librarian') {
      const savedId = localStorage.getItem('savedEmployeeId');
      if (savedId) {
        setEmployeeId(savedId);
        setRememberMe(true);
      }
    }
  }, [role]);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setError('');
    setBannedInfo(null);
    setEmail('');
    setPassword('');
    setEmployeeId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let apiEndpoint = 'http://localhost:3001/api/auth/login';
      let requestBody = {};

      if (role === 'reader') {
        requestBody = {
          email: email,
          password: password,
          type: 'student'
        };
      } else if (role === 'librarian') {
        apiEndpoint = 'http://localhost:3001/api/auth/login-librarian';
        requestBody = {
          employeeId: employeeId || email,
          password: password
        };
      } else if (role === 'admin') {
        requestBody = {
          email: email,
          password: password,
          type: 'admin'
        };
      }

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.blocked) {
          setBannedInfo({ reason: data.blockReason || '违反图书馆相关规定' });
          setError('');
        } else {
          setBannedInfo(null);
          setError(data.error || data.message || '登录失败');
        }
        setLoading(false);
        return;
      }
      setBannedInfo(null);

      if (role === 'librarian') {
        localStorage.setItem('librarianToken', data.token);
        localStorage.setItem('librarianInfo', JSON.stringify(data.librarian));
        if (rememberMe) {
          localStorage.setItem('savedEmployeeId', employeeId || email);
        } else {
          localStorage.removeItem('savedEmployeeId');
        }
        window.location.href = '/librarian-login';
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (role === 'admin') {
          window.location.href = '/admin-dashboard';
        } else {
          window.location.href = '/';
        }
      }
    } catch (err) {
      setError('网络错误，请确保后端已启动');
    } finally {
      setLoading(false);
    }
  };

  const roleConfig = {
    reader: {
      title: '读者登录',
      subtitle: '欢迎回来！请登录您的读者账号',
      usernameLabel: '邮箱',
      usernamePlaceholder: '请输入邮箱',
      usernameValue: email,
      usernameOnChange: (e) => setEmail(e.target.value)
    },
    librarian: {
      title: '图书管理员登录',
      subtitle: '欢迎回来！请登录您的管理账号',
      usernameLabel: '工号',
      usernamePlaceholder: '请输入工号',
      usernameValue: employeeId,
      usernameOnChange: (e) => setEmployeeId(e.target.value)
    },
    admin: {
      title: '管理员登录',
      subtitle: '欢迎回来！请登录您的管理员账号',
      usernameLabel: '邮箱',
      usernamePlaceholder: '请输入管理员邮箱',
      usernameValue: email,
      usernameOnChange: (e) => setEmail(e.target.value)
    }
  };

  const config = roleConfig[role];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">图书馆管理系统</h1>
            <p className="text-gray-500 mt-2">统一登录入口</p>
          </div>

          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => handleRoleChange('reader')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                role === 'reader'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              读者
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('librarian')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                role === 'librarian'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              图书管理员
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('admin')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                role === 'admin'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              管理员
            </button>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">{config.title}</h2>
            <p className="text-gray-500 text-sm mt-1">{config.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                {config.usernameLabel} <span className="text-red-500">*</span>
              </label>
              <input
                type={role === 'librarian' ? 'text' : 'email'}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition"
                placeholder={config.usernamePlaceholder}
                value={config.usernameValue}
                onChange={config.usernameOnChange}
                required
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                密码 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition pr-12"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {role === 'librarian' && (
              <div className="mb-4 flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="ml-2 text-sm text-gray-600">记住工号</span>
                </label>
              </div>
            )}

            {bannedInfo && (
              <div className="mb-4 p-4 bg-red-50 border-2 border-red-400 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🚫</span>
                  <span className="font-bold text-red-700 text-sm">账号已被封禁（Banned）</span>
                </div>
                <p className="text-red-600 text-sm">您的账号已被管理员封禁，无法登录。</p>
                <p className="text-red-500 text-xs mt-1">封禁原因：{bannedInfo.reason}</p>
                <p className="text-gray-400 text-xs mt-2">如有疑问，请联系图书馆管理员。</p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  登录中...
                </span>
              ) : '登 录'}
            </button>
          </form>

          {role === 'reader' && (
            <p className="text-center text-gray-500 text-sm mt-6">
              还没有账号？{' '}
              <a href="/register" className="text-blue-500 hover:text-blue-600 font-medium">
                立即注册
              </a>
            </p>
          )}
        </div>

        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
          <p className="text-center text-xs text-gray-500">
            登录即表示同意我们的服务条款
          </p>
        </div>
      </div>
    </div>
  );
};

export default UnifiedLogin;
