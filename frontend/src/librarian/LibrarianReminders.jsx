/**
 * 图书到期提醒管理页面 - 供馆员查看和管理提醒
 * 路由: /librarian/reminders
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import './LibrarianReminders.css';

const LibrarianReminders = () => {
  const [activeTab, setActiveTab] = useState('logs'); // logs, reminderList
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 20,
    status: 'all'
  });
  const [executing, setExecuting] = useState(false);

  // 获取馆员令牌
  const getToken = () => localStorage.getItem('token') || localStorage.getItem('librarianToken');

  // 获取提醒日志
  const fetchReminders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: filters.page,
        pageSize: filters.pageSize,
        status: filters.status
      });

      const response = await axios.get(
        `http://localhost:3001/api/librarian/reminders/logs?${params}`,
        {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }
      );

      setReminders(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('获取提醒日志失败:', error);
      alert('获取提醒日志失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 手动触发提醒邮件发送
  const triggerReminders = async () => {
    if (!window.confirm('确定要一键发送提醒邮件吗？这会再次向符合条件的用户发送提醒邮件。')) {
      return;
    }

    setExecuting(true);
    try {
      const response = await axios.post(
        'http://localhost:3001/api/librarian/reminders/send?force=true',
        {},
        {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }
      );

      alert(`提醒邮件发送完成！\n处理记录: ${response.data.data.totalProcessed}\n成功: ${response.data.data.successCount}\n失败: ${response.data.data.failureCount}`);
      fetchReminders();
    } catch (error) {
      console.error('执行提醒失败:', error);
      alert('执行提醒失败: ' + error.message);
    } finally {
      setExecuting(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    fetchReminders();
  }, [activeTab, filters]);

  // 处理筛选变化
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value
    }));
  };

  // 格式化日期
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  // 计算剩余天数
  const getDaysLeft = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  };

  // 状态徽章
  const StatusBadge = ({ status }) => {
    return (
      <span className={`badge badge-${status}`}>
        {status === 'success' ? '✅ 成功' : '❌ 失败'}
      </span>
    );
  };

  const uniqueReminderList = useMemo(() => {
    const map = new Map();

    reminders.forEach((reminder) => {
      const key = reminder.loan?.id ?? reminder.loanId ?? reminder.id;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, reminder);
      } else if (new Date(reminder.sendTime) > new Date(existing.sendTime)) {
        map.set(key, reminder);
      }
    });

    return Array.from(map.values()).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [reminders]);

  return (
    <div className="reminder-container">
      <div className="reminder-header">
        <h1>📧 图书到期提醒管理</h1>
        <button
          className="btn btn-primary"
          onClick={triggerReminders}
          disabled={executing}
        >
          {executing ? '发送中...' : '🔔 一键发送提醒'}
        </button>
      </div>

      {/* 标签切换 */}
      <div className="reminder-tabs">
        <button
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📋 提醒日志
        </button>
        <button
          className={`tab-btn ${activeTab === 'reminderList' ? 'active' : ''}`}
          onClick={() => setActiveTab('reminderList')}
        >
          📌 提醒名单
        </button>
      </div>

      {/* 日志标签页 */}
      {activeTab === 'logs' && (
        <div className="logs-section">
          <div className="filters">
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="filter-select"
            >
              <option value="all">全部状态</option>
              <option value="success">✅ 成功</option>
              <option value="failed">❌ 失败</option>
            </select>
            <span className="filter-info">
              共 {pagination.total} 条记录，第 {filters.page} / {pagination.totalPages} 页
            </span>
          </div>

          {loading ? (
            <div className="loading">加载中...</div>
          ) : reminders.length === 0 ? (
            <div className="empty-state">暂无提醒日志</div>
          ) : (
            <>
              <div className="logs-table">
                <table>
                  <thead>
                    <tr>
                      <th>用户</th>
                      <th>邮箱</th>
                      <th>图书名称</th>
                      <th>到期日期</th>
                      <th>发送状态</th>
                      <th>发送时间</th>
                      <th>错误信息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminders.map((reminder) => (
                      <tr key={reminder.id} className={`row-${reminder.sendStatus}`}>
                        <td>{reminder.user.name}</td>
                        <td>{reminder.user.email}</td>
                        <td>{reminder.bookTitle}</td>
                        <td>{formatDate(reminder.dueDate)}</td>
                        <td>
                          <StatusBadge status={reminder.sendStatus} />
                        </td>
                        <td>{formatDate(reminder.sendTime)}</td>
                        <td>
                          {reminder.errorMessage ? (
                            <span className="error-msg">{reminder.errorMessage}</span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页控制 */}
              <div className="pagination">
                <button
                  onClick={() => handleFilterChange('page', filters.page - 1)}
                  disabled={filters.page === 1}
                  className="btn"
                >
                  ← 上一页
                </button>
                <span className="page-info">
                  {filters.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => handleFilterChange('page', filters.page + 1)}
                  disabled={filters.page === pagination.totalPages}
                  className="btn"
                >
                  下一页 →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 统计标签页 */}
      {activeTab === 'reminderList' && (
        <div className="stats-section">
          {loading ? (
            <div className="loading">加载中...</div>
          ) : uniqueReminderList.length > 0 ? (
            <>
              <div className="stat-card-group">
                <h3>📌 需提醒名单 ({uniqueReminderList.length})</h3>
              </div>
              <div className="logs-table">
                <table>
                  <thead>
                    <tr>
                      <th>用户</th>
                      <th>邮箱</th>
                      <th>图书名称</th>
                      <th>到期日期</th>
                      <th>剩余天数</th>
                      <th>最近提醒状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueReminderList.map((reminder) => {
                      const dueDate = reminder.dueDate || reminder.loan?.dueDate;
                      return (
                        <tr key={reminder.loan?.id ?? reminder.id}>
                          <td>{reminder.user?.name || '未知用户'}</td>
                          <td>{reminder.user?.email || '-'}</td>
                          <td>{reminder.bookTitle || reminder.loan?.copy?.book?.title || '未知图书'}</td>
                          <td>{formatDate(dueDate)}</td>
                          <td>{getDaysLeft(dueDate)}</td>
                          <td>
                            <StatusBadge status={reminder.sendStatus || 'success'} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">暂无需提醒的名单</div>
          )}
        </div>
      )}
    </div>
  );
};

export default LibrarianReminders;
