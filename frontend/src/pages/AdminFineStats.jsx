import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminFineStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/statistics/fine-stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStats(data.stats);
          setGrandTotal(data.grandTotal);
        }
      })
      .catch((err) => console.error('获取罚款统计失败:', err))
      .finally(() => setLoading(false));
  }, []);

  const maxFine = Math.max(...stats.map((s) => s.totalFine), 1);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📚</div>
            <h1 className="text-xl font-bold text-gray-800">图书馆罚金支付流水阅读统计</h1>
          </div>
          <button
            onClick={() => navigate('/admin-dashboard')}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition text-sm"
          >
            返回控制台
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg shadow-lg p-6 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-2">图书馆罚金支付流水阅读统计</h2>
          <p className="opacity-90">按月度统计所有已缴纳的罚款金额</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : stats.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            暂无已缴纳的罚款记录
          </div>
        ) : (
          <>
            {/* 汇总卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-500 mb-1">总罚款金额</p>
                <p className="text-3xl font-bold text-orange-600">
                  ¥{grandTotal.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-500 mb-1">统计月数</p>
                <p className="text-3xl font-bold text-blue-600">{stats.length}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-500 mb-1">总缴纳次数</p>
                <p className="text-3xl font-bold text-green-600">
                  {stats.reduce((sum, s) => sum + s.fineCount, 0)}
                </p>
              </div>
            </div>

            {/* 月度统计图表 - 条形图 */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-6">月度趋势</h3>
              <div className="space-y-3">
                {stats.map((item) => {
                  const pct = (item.totalFine / maxFine) * 100;
                  return (
                    <div key={item.month}>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span className="font-medium">{item.month}</span>
                        <span>
                          ¥{item.totalFine.toFixed(2)}（{item.fineCount} 笔）
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-orange-400 to-red-500 h-full rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium transition-all duration-500"
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        >
                          {pct > 15 ? `¥${item.totalFine.toFixed(2)}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 详细数据表格 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <h3 className="text-lg font-bold text-gray-800 p-6 pb-0">详细数据</h3>
              <div className="p-6">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="py-3 px-4 text-gray-600 font-semibold">月份</th>
                      <th className="py-3 px-4 text-gray-600 font-semibold text-right">缴纳笔数</th>
                      <th className="py-3 px-4 text-gray-600 font-semibold text-right">罚款金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((item) => (
                      <tr key={item.month} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{item.month}</td>
                        <td className="py-3 px-4 text-right">{item.fineCount}</td>
                        <td className="py-3 px-4 text-right font-medium text-orange-600">
                          ¥{item.totalFine.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td className="py-3 px-4">合计</td>
                      <td className="py-3 px-4 text-right">
                        {stats.reduce((sum, s) => sum + s.fineCount, 0)}
                      </td>
                      <td className="py-3 px-4 text-right text-orange-600">
                        ¥{grandTotal.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default AdminFineStats;
