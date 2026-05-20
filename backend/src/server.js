// server.js
const app = require('./app');
const prisma = require('./lib/prisma');
const backupService = require('./services/backup');

const PORT = process.env.PORT || 3001;
const BACKUP_INTERVAL_MS = (() => {
  const raw = parseInt(process.env.BACKUP_INTERVAL_MS || '21600000', 10);
  if (!Number.isFinite(raw) || raw <= 0) {
    console.warn(`⚠️ 无效的 BACKUP_INTERVAL_MS (${process.env.BACKUP_INTERVAL_MS})，使用默认值 21600000 (6小时)`);
    return 21600000;
  }
  return raw;
})();

let backupTimer = null;

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

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    startScheduledBackup();

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║     📚 Library Management System API Server          ║
╠═══════════════════════════════════════════════════════╣
║  🚀 Server running on: http://localhost:${PORT}         ║
║  📖 API Documentation: http://localhost:${PORT}/health  ║
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
  await prisma.$disconnect();
  process.exit(0);
});

startServer();