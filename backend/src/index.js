require('dotenv').config();

const prisma = require('./lib/prisma');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

// 引入邮件和提醒服务
const { initEmailService } = require('./lib/email');
const { checkAndSendReminders } = require('./lib/reminder');

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
const remindersRouter = require('./routes/reminders');  // 图书到期提醒路由
const backupService = require("./services/backup");
const { runDueReminderJob, getNextDueReminderTime } = require('./services/dueReminder');

const app = express();
const port = Number(process.env.PORT) || 3001;

// 必须的中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

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
app.use('/api/librarian/reminders', remindersRouter);                   // 图书到期提醒路由
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
let reminderScheduler = null; // 定时任务句柄
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

/**
 * 启动图书到期提醒定时任务
 * 每日在指定时间执行提醒检查
 */
function startReminderScheduler() {
    // 使用 cron 表达式：每天凌晨 2 点执行 ("0 2 * * *")
    // 也可以改为其他时间，例如每天 8 点："0 8 * * *"
    const reminderCronTime = process.env.REMINDER_CRON_TIME || '0 8 * * *'; // 默认每天8点执行

    console.log(`⏰ 图书到期提醒任务已启动，执行时间表: ${reminderCronTime}`);

    reminderScheduler = cron.schedule(reminderCronTime, async () => {
        console.log(`\n⏰ [${new Date().toLocaleString('zh-CN')}] 触发图书到期提醒任务`);
        
        try {
            const result = await checkAndSendReminders();
            console.log(`✅ 提醒任务执行结果:`, result);
        } catch (error) {
            console.error(`❌ 提醒任务执行出错:`, error.message);
        }
    });

    // 可选：也可以在启动时立即执行一次提醒
    if (process.env.RUN_REMINDER_ON_START === 'true') {
        console.log('🔔 正在执行启动时的提醒检查...');
        checkAndSendReminders();
    }
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

        // 初始化邮件服务
        await initEmailService();

        startScheduledBackup();
        startReminderScheduler(); // 启动图书到期提醒定时任务
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
║  📧 Reminder endpoints: /api/librarian/reminders/*    ║
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
    if (reminderScheduler) {
        reminderScheduler.stop(); // 停止提醒定时任务
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
