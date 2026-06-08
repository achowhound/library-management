import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api';

function AdminBlocklist() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken');

  // 所有读者
  const [allReaders, setAllReaders] = useState([]);
  const [readerSearch, setReaderSearch] = useState('');
  const [loadingReaders, setLoadingReaders] = useState(true);

  // 黑名单
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blocklistSearch, setBlocklistSearch] = useState('');
  const [loadingBlocklist, setLoadingBlocklist] = useState(true);

  // 封禁弹窗
  const [blockingUser, setBlockingUser] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const fetchAllReaders = async () => {
    setLoadingReaders(true);
    try {
      const res = await fetch(`${API}/admin/blocklist/search?q=`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setAllReaders(data.users);
    } catch {
      showToast('获取读者列表失败', 'error');
    } finally {
      setLoadingReaders(false);
    }
  };

  const fetchBlockedUsers = async () => {
    setLoadingBlocklist(true);
    try {
      const res = await fetch(`${API}/admin/blocklist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setBlockedUsers(data.users);
    } catch {
      showToast('获取黑名单失败', 'error');
    } finally {
      setLoadingBlocklist(false);
    }
  };

  const refreshAll = () => {
    fetchAllReaders();
    fetchBlockedUsers();
  };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    refreshAll();
  }, [token]);

  const handleBlock = async () => {
    if (!blockReason.trim()) { showToast('请填写封禁原因', 'error'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/admin/blocklist/${blockingUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: blockReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        setBlockingUser(null);
        setBlockReason('');
        refreshAll();
      } else {
        showToast(data.message || '封禁失败', 'error');
      }
    } catch {
      showToast('操作失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnblock = async (userId, userName) => {
    if (!window.confirm(`确认将「${userName}」从黑名单中移除？`)) return;
    try {
      const res = await fetch(`${API}/admin/blocklist/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        refreshAll();
      } else {
        showToast(data.message || '解封失败', 'error');
      }
    } catch {
      showToast('操作失败', 'error');
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

  // 过滤：读者列表（排除已封禁）
  const filteredReaders = allReaders.filter(u =>
    !u.isBlocked &&
    (readerSearch.trim() === '' ||
      u.name.includes(readerSearch) ||
      u.email.includes(readerSearch) ||
      (u.studentId && u.studentId.includes(readerSearch)) ||
      String(u.id).includes(readerSearch))
  );

  // 过滤：黑名单搜索
  const filteredBlocklist = blockedUsers.filter(u =>
    blocklistSearch.trim() === '' ||
    u.name.includes(blocklistSearch) ||
    u.email.includes(blocklistSearch) ||
    (u.studentId && u.studentId.includes(blocklistSearch)) ||
    String(u.id).includes(blocklistSearch)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <nav className="bg-white shadow-md">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin-dashboard')} className="text-gray-400 hover:text-gray-700 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <span className="text-xl">🚫</span>
            <h1 className="text-xl font-bold text-gray-800">用户黑名单管理</h1>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium">读者总数：{allReaders.length} 人</span>
            <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full font-medium">已封禁：{blockedUsers.length} 人</span>
          </div>
        </div>
      </nav>

      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">

        {/* 顶部搜索栏 */}
        <section className="bg-white rounded-xl shadow p-4">
          <p className="text-sm text-gray-500 mb-3 font-medium">🔍 快速搜索读者（支持姓名 / 学号 / 邮箱 / ID）</p>
          <div className="flex gap-3">
            <input
              type="text"
              value={readerSearch}
              onChange={(e) => setReaderSearch(e.target.value)}
              placeholder="输入关键词筛选左侧读者列表..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
            {readerSearch && (
              <button onClick={() => setReaderSearch('')} className="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                清除
              </button>
            )}
          </div>
        </section>

        {/* 左右两列 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 左：所有读者 */}
          <section className="bg-white rounded-xl shadow flex flex-col" style={{ maxHeight: '70vh' }}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                所有读者
                <span className="ml-2 text-sm font-normal text-gray-400">（{filteredReaders.length} 人可封禁）</span>
              </h2>
            </div>

            <div className="overflow-y-auto flex-1">
              {loadingReaders ? (
                <div className="flex justify-center items-center h-40">
                  <svg className="animate-spin h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : filteredReaders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
                  <div className="text-3xl mb-2">👤</div>
                  {readerSearch ? '没有匹配的读者' : '暂无读者'}
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">学号</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">邮箱</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredReaders.map((u) => (
                      <tr key={u.id} className="hover:bg-red-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                        <td className="px-4 py-3 text-gray-500">{u.studentId || '-'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[140px]">{u.email}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setBlockingUser(u); setBlockReason(''); }}
                            className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs font-medium transition"
                          >
                            封禁
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* 右：黑名单 */}
          <section className="bg-white rounded-xl shadow flex flex-col" style={{ maxHeight: '70vh' }}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-3">
                黑名单
                <span className="ml-2 text-sm font-normal text-gray-400">（{blockedUsers.length} 人）</span>
              </h2>
              <input
                type="text"
                value={blocklistSearch}
                onChange={(e) => setBlocklistSearch(e.target.value)}
                placeholder="搜索黑名单中的用户..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
              />
            </div>

            <div className="overflow-y-auto flex-1">
              {loadingBlocklist ? (
                <div className="flex justify-center items-center h-40">
                  <svg className="animate-spin h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : filteredBlocklist.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
                  <div className="text-3xl mb-2">{blocklistSearch ? '🔍' : '✅'}</div>
                  {blocklistSearch ? '没有匹配的封禁用户' : '黑名单为空'}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredBlocklist.map((u) => (
                    <div key={u.id} className="px-5 py-4 hover:bg-red-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-800">{u.name}</span>
                            <span className="text-xs text-gray-400">{u.studentId || `ID:${u.id}`}</span>
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">封禁中</span>
                          </div>
                          <div className="text-xs text-gray-400 mb-1 truncate">{u.email}</div>
                          <div className="text-xs text-red-500 bg-red-50 rounded px-2 py-1 inline-block">
                            原因：{u.blockReason || '-'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">封禁时间：{formatDate(u.blockedAt)}</div>
                        </div>
                        <button
                          onClick={() => handleUnblock(u.id, u.name)}
                          className="flex-shrink-0 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-xs font-medium transition"
                        >
                          解封
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>
      </main>

      {/* 封禁原因弹窗 */}
      {blockingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">确认封禁</h3>
              <p className="text-sm text-gray-500 mt-1">
                即将封禁：<span className="font-semibold text-gray-700">{blockingUser.name}</span>
                {blockingUser.studentId && <span className="ml-1 text-gray-400">（{blockingUser.studentId}）</span>}
              </p>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm font-medium text-gray-700 mb-3">选择或填写封禁原因：</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {['严重逾期未还书', '损坏图书馆财物', '违反借阅规定', '账号异常行为'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setBlockReason(preset)}
                    className={`px-3 py-2 rounded-lg border text-sm text-left transition ${
                      blockReason === preset
                        ? 'border-red-400 bg-red-50 text-red-700 font-medium'
                        : 'border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-600'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="或自定义填写原因..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
              />
            </div>
            <div className="px-6 py-4 flex gap-3 border-t border-gray-100">
              <button
                onClick={handleBlock}
                disabled={submitting || !blockReason.trim()}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition font-medium text-sm"
              >
                {submitting ? '处理中...' : '确认封禁'}
              </button>
              <button
                onClick={() => { setBlockingUser(null); setBlockReason(''); }}
                className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminBlocklist;
