import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: 'success' });
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    studentId: '',
    password: '',
    role: 'STUDENT'
  });
  const navigate = useNavigate();
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken');

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/readers/all', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      setMessage({ text: '获取用户列表失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchUsers();
  }, [token, navigate]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await fetch(`/api/readers/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (response.ok) {
        setMessage({ text: '角色更新成功', type: 'success' });
        fetchUsers();
      } else {
        setMessage({ text: '更新失败', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: '更新失败', type: 'error' });
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/readers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ text: '用户创建成功', type: 'success' });
        setShowForm(false);
        setNewUser({ name: '', email: '', studentId: '', password: '', role: 'STUDENT' });
        fetchUsers();
      } else {
        setMessage({ text: data.message || '创建失败', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: '创建失败', type: 'error' });
    }
  };

  const handleBack = () => {
    navigate('/admin-dashboard');
  };

  const getRoleName = (role) => {
    switch (role) {
      case 'STUDENT': return '学生';
      case 'LIBRARIAN': return '馆员';
      case 'ADMIN': return '管理员';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={handleBack}
                className="mr-4 text-gray-600 hover:text-gray-800 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-800">用户管理</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                + 新增用户
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <p className="text-gray-500 mb-6">管理系统用户和权限</p>

        {message.text && (
          <div className={`mb-6 p-4 border rounded-lg ${
            message.type === 'error'
              ? 'bg-red-100 border-red-400 text-red-700'
              : 'bg-green-100 border-green-400 text-green-700'
          }`}>
            {message.text}
          </div>
        )}

        {showForm && (
          <div className="mb-8 p-6 bg-white rounded-lg shadow border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">新增用户</h2>
            <form onSubmit={handleCreateUser}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="姓名 *"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
                <input
                  type="email"
                  placeholder="邮箱 *"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="学号（选填）"
                  value={newUser.studentId}
                  onChange={(e) => setNewUser({ ...newUser, studentId: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
                <input
                  type="password"
                  placeholder="密码 *（至少6位）"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                >
                  <option value="STUDENT">学生</option>
                  <option value="LIBRARIAN">馆员</option>
                  <option value="ADMIN">管理员</option>
                </select>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                  创建
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邮箱</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">学号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.studentId || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getRoleName(user.role)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="STUDENT">学生</option>
                        <option value="LIBRARIAN">馆员</option>
                        <option value="ADMIN">管理员</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default UserManagement;
