import { useEffect, useMemo, useState } from 'react'
import { API_URL, getAuthHeaders } from './api'

export default function LibrarianFineView({ onBack }) {
  const [records, setRecords] = useState([])
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalFineAmount: 0,
    librarianCount: 0,
    salaryPerLibrarian: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const formatCurrency = (amount) => {
    const safeAmount = Number(amount || 0)
    return `¥${safeAmount.toFixed(2)}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const fetchFinePayments = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`${API_URL}/loans/fine-payments`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '获取罚款缴费记录失败')
      }

      setRecords(data.records || [])
      setStats(data.stats || {
        totalRecords: 0,
        totalFineAmount: 0,
        librarianCount: 0,
        salaryPerLibrarian: 0,
      })
    } catch (err) {
      setError(err.message)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFinePayments()
  }, [])

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return records

    return records.filter((record) => {
      const values = [
        record.user?.name,
        record.user?.studentId,
        record.user?.email,
        record.book?.title,
        record.book?.isbn,
        record.copy?.barcode,
        record.loanBarcode,
      ]

      return values.some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  }, [records, search])

  return (
    <div className="max-w-6xl mx-auto">
      <button
        onClick={onBack}
        className="mb-4 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition flex items-center gap-2"
      >
        <span>←</span> 返回
      </button>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>💰</span> 罚款缴费与工资统计
          </h2>
          <p className="text-amber-100 text-sm mt-1">查看用户逾期罚款缴费记录，并按馆员人数统计每位馆员工资</p>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <p className="text-sm text-amber-700 mb-1">缴费记录</p>
              <p className="text-3xl font-bold text-amber-600">{loading ? '...' : stats.totalRecords}</p>
              <p className="text-xs text-amber-600 mt-2">笔</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-sm text-green-700 mb-1">罚款总额</p>
              <p className="text-3xl font-bold text-green-600">{loading ? '...' : formatCurrency(stats.totalFineAmount)}</p>
              <p className="text-xs text-green-600 mt-2">已缴纳</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-sm text-blue-700 mb-1">馆员人数</p>
              <p className="text-3xl font-bold text-blue-600">{loading ? '...' : stats.librarianCount}</p>
              <p className="text-xs text-blue-600 mt-2">人</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <p className="text-sm text-purple-700 mb-1">每位馆员工资</p>
              <p className="text-3xl font-bold text-purple-600">{loading ? '...' : formatCurrency(stats.salaryPerLibrarian)}</p>
              <p className="text-xs text-purple-600 mt-2">罚款总额 / 馆员人数</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="按用户、学号、邮箱、书名、ISBN、条形码搜索"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              onClick={fetchFinePayments}
              disabled={loading}
              className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? '刷新中...' : '刷新记录'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-16 text-center text-gray-500">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              正在加载罚款缴费记录...
            </div>
          ) : filteredRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">序号</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">用户</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">图书</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">副本条形码</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">应还时间</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">归还时间</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">缴费时间</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">缴费金额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecords.map((record, index) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{record.user?.name || '未知用户'}</div>
                        <div className="text-xs text-gray-500">学号：{record.user?.studentId || '-'}</div>
                        <div className="text-xs text-gray-400">{record.user?.email || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{record.book?.title || '未知图书'}</div>
                        <div className="text-xs text-gray-500">ISBN：{record.book?.isbn || '-'}</div>
                        <div className="text-xs text-gray-400">作者：{record.book?.author || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>{record.copy?.barcode || '-'}</div>
                        <div className="text-xs text-gray-400 mt-1">借阅码：{record.loanBarcode || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(record.dueDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(record.returnDate)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(record.paidAt)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                          {formatCurrency(record.fineAmount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center bg-gray-50 rounded-xl">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500">暂无匹配的罚款缴费记录</p>
              <p className="text-gray-400 text-sm mt-2">用户完成逾期罚款支付后会显示在这里</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
