import { useState, useEffect } from 'react'
import { API_URL, getAuthHeaders } from './api'

export default function LibrarianPendingReminders({ onBack }) {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')

  const fetchPending = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/loans/pending-reminders`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (res.ok && data.success) {
        setItems(data.reminders || [])
      } else {
        setMessage(data.message || '无法获取需要提醒的名单')
      }
    } catch (err) {
      setMessage('获取名单失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const runReminders = async () => {
    setRunning(true)
    setMessage('')
    try {
      // 如果有选中项，发送所选；否则执行全部发送
      if (selected && selected.size > 0) {
        const loanIds = Array.from(selected)
        const res = await fetch(`${API_URL}/loans/reminders/send`, {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ loanIds }),
        })
        const data = await res.json()
        if (res.ok && data.success) {
          setMessage(`已发送所选：处理 ${data.processed} 条，发送 ${data.sent} 条，失败 ${data.failed} 条`)
          setSelected(new Set())
          await fetchPending()
        } else {
          setMessage(data.message || '执行失败')
        }
      } else {
        // fallback：执行全部发送
        const res = await fetch(`${API_URL}/loans/reminders/run`, { method: 'POST', headers: getAuthHeaders() })
        const data = await res.json()
        if (res.ok && data.success) {
          setMessage(`已执行提醒任务：处理 ${data.processed} 条，发送 ${data.sent} 条，失败 ${data.failed} 条`)
          await fetchPending()
        } else {
          setMessage(data.message || '执行失败')
        }
      }
    } catch (err) {
      setMessage('执行提醒失败，请重试')
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => { fetchPending() }, [])

  const formatDate = (v) => {
    if (!v) return '-'
    try { return new Date(v).toLocaleString('zh-CN', { year:'numeric',month:'2-digit',day:'2-digit' }) } catch { return v }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">需要提醒的读者名单</h2>
          <p className="text-sm text-gray-500 mt-1">列出在未来几天内到期且未续借的借阅，供馆员查看并一键发送提醒。</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="px-4 py-2 rounded-lg border">返回</button>
          <button onClick={runReminders} disabled={running} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60">
            {running ? '正在执行...' : '一键发送提醒'}
          </button>
        </div>
      </div>

      {message && <div className="rounded p-3 bg-blue-50 text-blue-800">{message}</div>}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(items.map((it) => it.loanId)))
                    } else {
                      setSelected(new Set())
                    }
                  }}
                />
              </th>
              <th className="px-4 py-3">到期日期</th>
              <th className="px-4 py-3">读者</th>
              <th className="px-4 py-3">学号</th>
              <th className="px-4 py-3">邮箱</th>
              <th className="px-4 py-3">图书</th>
              <th className="px-4 py-3">借阅条码</th>
              <th className="px-4 py-3">发送时间</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500">加载中...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500">暂无需要提醒的读者</td></tr>
            ) : (
              items.map(it => (
                <tr key={it.loanId} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(it.loanId)}
                      onChange={(e) => {
                        const next = new Set(selected)
                        if (e.target.checked) next.add(it.loanId)
                        else next.delete(it.loanId)
                        setSelected(next)
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">{formatDate(it.dueDate)}</td>
                  <td className="px-4 py-3">{it.user?.name || '-'}</td>
                  <td className="px-4 py-3">{it.user?.studentId || '-'}</td>
                  <td className="px-4 py-3">{it.user?.email || '-'}</td>
                  <td className="px-4 py-3">{it.book?.title || '-'}</td>
                  <td className="px-4 py-3">{it.barcode || '-'}</td>
                  <td className="px-4 py-3">{it.lastSentAt ? new Date(it.lastSentAt).toLocaleString('zh-CN') : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
