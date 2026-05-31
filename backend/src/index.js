require('dotenv').config();

const prisma = require('./lib/prisma');
const express = require('express');
const cors = require('cors');

// 1. 引入路由文件
const booksRouter = require('./routes/books');
const logsRouter = require('./routes/logs');
const loansRouter = require('./routes/loans'); // 借阅路由
const authRouter = require('./routes/auth');   // 鉴权路由
const readersRouter = require('./routes/readers');
const readerBorrowRouter = require('./routes/reader-borrow');
const announcementsRouter = require('./routes/announcements');
const messagesRouter = require('./routes/messages');                              // 你的：消息路由
const ratingsRouter = require('./routes/ratings');                                // 你的：评分路由
const librarianSearchBorrowHistory = require('./routes/LibrarianSearchBorrowHistory');  // 你的：馆员搜索历史
const statisticsRoutes = require('./routes/statistics');// 你的：统计路由
const configRouter = require('./routes/config');
const backupsRouter = require("./routes/backups");
const blocklistRouter = require("./routes/blocklist");
const backupService = require("./services/backup");
const { runDueReminderJob, getNextDueReminderTime } = require('./services/dueReminder');

const app = express();
const port = Number(process.env.PORT) || 3001;

// 必须的中间件
app.use(cors());
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: "ok", message: "Library API is running" });
});

// 2. 挂载路由 (合成了两边的要求)
app.use('/api/auth', authRouter);           // 学生登录
app.use('/api/librarian/auth', authRouter); // 馆员登录
app.use('/api/books', booksRouter);
app.use('/api/logs', logsRouter);
app.use('/api/loans', loansRouter);         // 借阅历史入口
app.use('/api/announcements', announcementsRouter);
app.use('/api/messages', messagesRouter);   // 消息系统路由（你的）
app.use('/api/ratings', ratingsRouter);     // 评分评价路由（你的）
app.use('/api/readers', readersRouter);
app.use('/loans', loansRouter);
app.use('/api/reader', readerBorrowRouter);
app.use('/api/librarian/search-history', librarianSearchBorrowHistory);  // 馆员搜索历史（你的）
app.use('/api/statistics', statisticsRoutes);                            // 统计路由（你的）
app.use('/api/config', configRouter);                                        // 系统配置
app.use('/api/backups', backupsRouter);                                      // 数据库备份
app.use('/api/admin/blocklist', blocklistRouter);                             // 用户黑名单管理

// 兼容旧路径（保留队友的设置）
app.use('/books', booksRouter);
app.use('/logs', logsRouter);

// 3. 错误处理 (保留队友新增的 404 和 500 处理)
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(error?.statusCode || 500).json({
    message: error?.message || 'Internal server error',
  });
});

const BACKUP_INTERVAL_MS = (() => {
    const raw = parseInt(process.env.BACKUP_INTERVAL_MS || '21600000', 10);
    if (!Number.isFinite(raw) || raw <= 0) {
        console.warn(`⚠️ 无效的 BACKUP_INTERVAL_MS (${process.env.BACKUP_INTERVAL_MS})，使用默认值 21600000 (6小时)`);
        return 21600000;
    }
    return raw;
})();

let backupTimer = null;
let reminderTimer = null;

function scheduleNextBackup() {
    backupTimer = setTimeout(async () => {
        try {
            const backup = await backupService.createBackup({ type: 'scheduled' });
            console.log(`[${new Date().toISOString()}] ✅ 定时备份完成: ${backup.filename} (${(Number(backup.sizeBytes) / 1024).toFixed(1)} KB)`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ 定时备份失败:`, error.message);
        }
        scheduleNextBackup();
    }, BACKUP_INTERVAL_MS);
}

function scheduleNextDueReminder() {
    const nextRun = getNextDueReminderTime();
    const delay = nextRun.getTime() - Date.now();

    reminderTimer = setTimeout(async () => {
        try {
            const result = await runDueReminderJob();
            console.log(`[${new Date().toISOString()}] ✅ 到期提醒任务完成: 处理 ${result.processed} 条，发送 ${result.sent} 条，失败 ${result.failed} 条`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ 到期提醒任务失败:`, error.message || error);
        }
        scheduleNextDueReminder();
    }, delay);
}

function startScheduledBackup() {
    console.log(`⏰ 定时备份已启动，间隔: ${BACKUP_INTERVAL_MS / 3600000} 小时`);
    // 先执行一次，然后递归调度
    setImmediate(async () => {
        try {
            const backup = await backupService.createBackup({ type: 'scheduled' });
            console.log(`[${new Date().toISOString()}] ✅ 初始定时备份完成: ${backup.filename} (${(Number(backup.sizeBytes) / 1024).toFixed(1)} KB)`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ 初始定时备份失败:`, error.message);
        }
        scheduleNextBackup();
    });
}

function startDueReminderScheduler() {
    const nextRun = getNextDueReminderTime();
    console.log(`⏰ 到期提醒调度已启动，下一次执行: ${nextRun.toLocaleString('zh-CN')}`);
    scheduleNextDueReminder();
}

async function startServer() {
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');

        startScheduledBackup();
        startDueReminderScheduler();

        app.listen(port, () => {
            console.log(`
╔═══════════════════════════════════════════════════════╗
║     📚 Library Management System API Server          ║
╠═══════════════════════════════════════════════════════╣
║  🚀 Server running on: http://localhost:${port}         ║
║  📖 API Documentation: http://localhost:${port}/health  ║
║  🔑 Auth endpoints: /api/auth/*                       ║
║  📕 Books endpoints: /api/books/*                     ║
║  📋 Loans endpoints: /api/loans/*                     ║
║  💾 Backup endpoints: /api/backups/*                  ║
║  ⏰ Auto backup every ${BACKUP_INTERVAL_MS / 3600000} hours                    ║
╚═══════════════════════════════════════════════════════╝
      `);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down gracefully...');
    if (backupTimer) {
        clearTimeout(backupTimer);
    }
    if (reminderTimer) {
        clearTimeout(reminderTimer);
    }
    await prisma.$disconnect();
    process.exit(0);
});

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

startServer();