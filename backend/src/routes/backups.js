const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { writeAuditLog } = require('../lib/audit');
const backupService = require('../services/backup');

const router = express.Router();

router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const backup = await backupService.createBackup({
      type: 'manual',
      userId: req.user.id,
    });

    writeAuditLog({
      userId: req.user.id,
      action: 'CREATE_BACKUP',
      entity: 'BackupLog',
      entityId: backup.id,
      detail: `管理员 ${req.user.email} 手动创建备份: ${backup.filename}`,
    });

    return res.status(201).json({
      message: '备份创建成功',
      backup: {
        id: backup.id,
        filename: backup.filename,
        sizeBytes: backup.sizeBytes.toString(),
        createdAt: backup.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const backups = await backupService.listBackups();
    return res.json({ backups });
  } catch (error) {
    return next(error);
  }
});

router.get('/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = await backupService.getBackupStatus();
    return res.json(status);
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/restore', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const backupId = parseInt(req.params.id, 10);
    if (isNaN(backupId)) {
      return res.status(400).json({ message: '无效的备份ID' });
    }

    const result = await backupService.restoreBackup(backupId, req.user.id);

    writeAuditLog({
      userId: req.user.id,
      action: 'RESTORE_BACKUP',
      entity: 'BackupLog',
      entityId: backupId,
      detail: `管理员 ${req.user.email} 从备份恢复数据库: ${result.restoredFrom}`,
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const backupId = parseInt(req.params.id, 10);
    if (isNaN(backupId)) {
      return res.status(400).json({ message: '无效的备份ID' });
    }

    const result = await backupService.deleteBackup(backupId);

    writeAuditLog({
      userId: req.user.id,
      action: 'DELETE_BACKUP',
      entity: 'BackupLog',
      entityId: backupId,
      detail: `管理员 ${req.user.email} 删除了备份记录 #${backupId}`,
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
