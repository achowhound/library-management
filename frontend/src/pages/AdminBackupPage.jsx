import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Database, Download, Trash2, RefreshCw, Clock, HardDrive, CheckCircle, AlertCircle } from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const num = Number(bytes);
  if (num === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(num) / Math.log(1024));
  return (num / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function getTypeLabel(type) {
  return type === 'manual' ? '手动' : '定时';
}

function getTypeBadge(type) {
  return type === 'manual'
    ? 'bg-blue-100 text-blue-700'
    : 'bg-gray-100 text-gray-600';
}

export default function AdminBackupPage() {
  const { apiRequest } = useAuth();
  const [backups, setBackups] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [confirmRestore, setConfirmRestore] = useState(null);

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [backupsData, statusData] = await Promise.all([
        apiRequest('/backups'),
        apiRequest('/backups/status'),
      ]);
      setBackups(backupsData.backups || []);
      setStatus(statusData);
    } catch (err) {
      showMessage('error', '加载数据失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [apiRequest, showMessage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const data = await apiRequest('/backups', {
        method: 'POST',
      });
      showMessage('success', `备份创建成功: ${data.backup.filename}`);
      await loadData();
    } catch (err) {
      showMessage('error', '备份失败: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (backupId) => {
    try {
      const data = await apiRequest(`/backups/${backupId}/restore`, {
        method: 'POST',
      });
      showMessage('success', `数据库已从备份恢复，安全备份ID: ${data.safetyBackupId}`);
      setConfirmRestore(null);
      await loadData();
    } catch (err) {
      showMessage('error', '恢复失败: ' + err.message);
      setConfirmRestore(null);
    }
  };

  const handleDelete = async (backupId) => {
    if (!confirm('确定要删除此备份吗？')) return;
    try {
      await apiRequest(`/backups/${backupId}`, {
        method: 'DELETE',
      });
      showMessage('success', '备份已删除');
      await loadData();
    } catch (err) {
      showMessage('error', '删除失败: ' + err.message);
    }
  };

  if (loading && backups.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" />
          数据库备份管理
        </h1>
        <p className="text-gray-600 mt-1">
          创建、查看和恢复数据库备份。所有操作需要管理员权限。
        </p>
      </div>

      {/* 消息提示 */}
      {message.text && (
        <div
          className={`mb-4 p-3 rounded-md flex items-center gap-2 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* 状态概览卡片 */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">总备份数</p>
                <p className="text-xl font-bold">{status.totalBackups}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">成功备份</p>
                <p className="text-xl font-bold">{status.completedBackups}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <HardDrive className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">总大小</p>
                <p className="text-xl font-bold">{formatBytes(status.totalSizeBytes)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">最新备份</p>
                <p className="text-sm font-bold truncate max-w-[120px]">
                  {status.latestBackup ? formatDate(status.latestBackup.createdAt) : '无'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 mb-6">
        <Button onClick={handleCreateBackup} disabled={creating}>
          {creating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              备份中...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              创建备份
            </>
          )}
        </Button>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 确认恢复对话框 */}
      {confirmRestore && (
        <div className="mb-6 p-4 border border-amber-200 bg-amber-50 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">确认恢复数据库？</p>
              <p className="text-sm text-amber-700 mt-1">
                将用备份 <strong>{confirmRestore.filename}</strong> 覆盖当前数据库。
                系统会自动先创建当前数据库的安全备份。此操作不可撤销。
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={() => handleRestore(confirmRestore.id)}
                >
                  确认恢复
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmRestore(null)}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 备份列表 */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-3 border-b bg-gray-50 rounded-t-lg">
          <h2 className="font-semibold">备份记录</h2>
        </div>
        {backups.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <Database className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>暂无备份记录</p>
            <p className="text-sm mt-1">点击上方"创建备份"按钮创建第一个备份</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">文件名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">类型</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">大小</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">创建时间</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">备注</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{backup.filename}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeBadge(backup.type)}`}>
                        {getTypeLabel(backup.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatBytes(backup.sizeBytes)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(backup.createdAt)}</td>
                    <td className="px-4 py-3">
                      {backup.status === 'completed' ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" />
                          成功
                        </span>
                      ) : backup.status === 'failed' ? (
                        <span className="text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          失败
                        </span>
                      ) : (
                        <span className="text-gray-500">{backup.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                      {backup.note || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {backup.status === 'completed' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-600 border-amber-200 hover:bg-amber-50"
                              onClick={() => setConfirmRestore(backup)}
                              title="恢复此备份"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => handleDelete(backup.id)}
                              title="删除备份"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500 rounded-b-lg border-t">
          最多保留最近 10 个备份，超出部分将自动清理。
        </div>
      </div>
    </div>
  );
}
