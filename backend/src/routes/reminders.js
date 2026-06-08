/**
 * 图书到期提醒日志路由 - 供馆员查询和管理提醒记录
 * 路由前缀: /api/librarian/reminders
 */

const express = require('express');
const router = express.Router();
const { getReminderLogs, getUserReminderStats, checkAndSendReminders } = require('../lib/reminder');
const { initEmailService } = require('../lib/email');
const { requireLibrarianAuth: librarianAuth } = require('../middleware/librarianAuth');

/**
 * POST /api/librarian/reminders/send
 * 手动触发图书到期提醒任务（管理员权限）
 * 用于测试和手动执行提醒；如果传入 force=true，则会再次向符合条件的用户发送提醒邮件
 */
router.post('/send', librarianAuth, async (req, res) => {
  try {
    // 确保邮件服务已初始化
    await initEmailService();

    const force = req.query.force === 'true' || req.body.force === true;
    const result = await checkAndSendReminders({ force });
    return res.json({
      success: result.success,
      message: result.message,
      data: {
        totalProcessed: result.totalProcessed,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duration: result.duration,
      },
    });
  } catch (error) {
    console.error('手动触发提醒失败:', error);
    return res.status(500).json({
      success: false,
      message: '提醒任务执行失败',
      error: error.message,
    });
  }
});

/**
 * GET /api/librarian/reminders/logs
 * 获取提醒日志列表（分页）
 * 查询参数:
 *   - page: 页码 (默认: 1)
 *   - pageSize: 每页数量 (默认: 20)
 *   - status: 状态筛选 (success/failed/all, 默认: all)
 *   - userId: 用户ID筛选 (可选)
 */
router.get('/logs', librarianAuth, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status = 'all', userId } = req.query;

    const result = await getReminderLogs({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      status,
      userId: userId ? parseInt(userId) : null,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: '获取日志失败',
        error: result.error,
      });
    }

    return res.json({
      success: true,
      message: '获取日志成功',
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('查询提醒日志失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取日志失败',
      error: error.message,
    });
  }
});

/**
 * GET /api/librarian/reminders/logs/user/:userId
 * 获取特定用户的提醒统计和最近的提醒记录
 * 参数:
 *   - userId: 用户ID (路径参数)
 */
router.get('/logs/user/:userId', librarianAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: '无效的用户ID',
      });
    }

    const result = await getUserReminderStats(parseInt(userId));

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: result.error,
      });
    }

    return res.json({
      success: true,
      message: '获取用户统计信息成功',
      data: result.data,
    });
  } catch (error) {
    console.error('获取用户提醒统计失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取统计信息失败',
      error: error.message,
    });
  }
});

/**
 * GET /api/librarian/reminders/stats/summary
 * 获取提醒系统总体统计
 */
router.get('/stats/summary', librarianAuth, async (req, res) => {
  try {
    const prisma = require('../lib/prisma');

    const totalReminders = await prisma.reminderLog.count();
    const successCount = await prisma.reminderLog.count({
      where: { sendStatus: 'success' },
    });
    const failureCount = await prisma.reminderLog.count({
      where: { sendStatus: 'failed' },
    });

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const todayReminders = await prisma.reminderLog.count({
      where: {
        sendTime: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    const todaySuccess = await prisma.reminderLog.count({
      where: {
        sendStatus: 'success',
        sendTime: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekReminders = await prisma.reminderLog.count({
      where: {
        sendTime: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
    });

    return res.json({
      success: true,
      message: '获取统计信息成功',
      data: {
        total: {
          totalReminders,
          successCount,
          failureCount,
          successRate: totalReminders > 0 ? ((successCount / totalReminders) * 100).toFixed(2) + '%' : '0%',
        },
        today: {
          count: todayReminders,
          successCount: todaySuccess,
          successRate: todayReminders > 0 ? ((todaySuccess / todayReminders) * 100).toFixed(2) + '%' : '0%',
        },
        thisWeek: {
          count: weekReminders,
        },
      },
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取统计信息失败',
      error: error.message,
    });
  }
});

module.exports = router;
