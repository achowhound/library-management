import { useState, useEffect } from 'react'
import { API_URL, getAuthHeaders } from './api'

export default function LibrarianReminderLogs({ onBack }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/loans/reminder-logs`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setLogs(data.logs || [])
      } else {
        setMessage(data.message || '无法获取提醒日志')
      }
    } catch (error) {
      setMessage('获取提醒日志失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const runReminders = async () => {
    setRunning(true)
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/loans/reminders/run`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setMessage(`已执行提醒任务：处理 ${data.processed} 条，发送 ${data.sent} 条，失败 ${data.failed} 条`)
        await fetchLogs()
      } else {
        setMessage(data.message || '提醒任务执行失败')
      }
    } catch (error) {
      setMessage('提醒任务执行失败，请重试')
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const formatDate = (value) => {
    if (!value) return '-'
    try {
      return new Date(value).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return value
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">到期提醒日志</h2>
          <p className="text-sm text-gray-500 mt-1">查看已发送到期提醒的历史记录，并手动触发一次提醒任务。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
          >
            返回
          </button>
          <button
            onClick={runReminders}
            disabled={running}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? '正在执行...' : '手动发送提醒'}
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          {message}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">发送时间</th>
              <th className="px-4 py-3 font-medium">读者</th>
              <th className="px-4 py-3 font-medium">邮箱</th>
              <th className="px-4 py-3 font-medium">图书</th>
              <th className="px-4 py-3 font-medium">到期日期</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">错误信息</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-4 py-6 text-center text-gray-500">加载中...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-6 text-center text-gray-500">暂无提醒日志</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-gray-700">{formatDate(log.sentAt)}</td>
                  <td className="px-4 py-4 text-gray-700">{log.user?.name || '未知'}</td>
                  <td className="px-4 py-4 text-gray-700">{log.email}</td>
                  <td className="px-4 py-4 text-gray-700">{log.book?.title || log.loan?.copy?.book?.title || '未知'}</td>
                  <td className="px-4 py-4 text-gray-700">{formatDate(log.loan?.dueDate)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${log.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-700 break-words max-w-xs">{log.errorMessage || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
