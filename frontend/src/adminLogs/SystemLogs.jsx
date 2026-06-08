import React, { useEffect, useState } from 'react';

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('librarianToken');
    
    if (!token) {
      window.location.href = '/login';
      return;
    }

    fetch('/api/logs', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      setLogs(data);
      setLoading(false);
    })
    .catch(err => {
      console.error('Error:', err);
      setError(err.message);
      setLoading(false);
    });
  }, []);

  const goBack = () => {
    window.location.href = '/admin-dashboard';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', width: 40, height: 40, animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
          <p style={{ marginTop: 20, color: '#666' }}>加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <button onClick={goBack} style={{ marginBottom: 20, padding: '8px 16px', cursor: 'pointer' }}>
          ← 返回
        </button>
        <div style={{ padding: 20, background: '#ffebee', border: '1px solid #ef5350', borderRadius: 8, color: '#c62828' }}>
          <h3>错误</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 10, padding: '8px 16px', background: '#1976d2', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <nav style={{ background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 64 }}>
            <button onClick={goBack} style={{ marginRight: 16, padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>
              ← 返回
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>系统日志</h1>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
        <p style={{ color: '#666', marginBottom: 20 }}>查看和监控系统操作记录</p>

        {logs.length === 0 ? (
          <div style={{ background: 'white', padding: 40, borderRadius: 8, textAlign: 'center', color: '#999' }}>
            暂无日志记录
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>ID</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>用户</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>操作</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>实体</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>详情</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>时间</th>
                </tr>
              </thead>
              <tbody style={{ background: 'white' }}>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: 12, fontSize: 14 }}>{log.id}</td>
                    <td style={{ padding: 12, fontSize: 14, color: '#6b7280' }}>{log.user?.name || log.userId || '-'}</td>
                    <td style={{ padding: 12, fontSize: 14 }}>{log.action}</td>
                    <td style={{ padding: 12, fontSize: 14, color: '#6b7280' }}>{log.entity}</td>
                    <td style={{ padding: 12, fontSize: 14, color: '#6b7280' }}>{log.detail || '-'}</td>
                    <td style={{ padding: 12, fontSize: 14, color: '#6b7280' }}>
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
