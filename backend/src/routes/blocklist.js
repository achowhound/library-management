const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

async function writeAuditLog(data) {
  try {
    await prisma.auditLog.create({ data });
  } catch (error) {
    console.warn('Failed to write audit log:', error.message);
  }
}

// 搜索用户（按 ID、姓名、邮箱、学号）
router.get('/search', requireAuth, requireAdmin, async (req, res) => {
  const { q } = req.query;
  const keyword = (q || '').trim();

  try {
    const userId = parseInt(keyword);
    const whereClause = keyword === ''
      ? { role: 'STUDENT' }
      : {
          OR: [
            ...(isNaN(userId) ? [] : [{ id: userId }]),
            { name: { contains: keyword } },
            { email: { contains: keyword } },
            { studentId: { contains: keyword } },
          ],
          role: 'STUDENT',
        };

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        role: true,
        isBlocked: true,
        blockReason: true,
        blockedAt: true,
      },
      take: 100,
    });

    res.json({ success: true, users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '搜索失败' });
  }
});

// 获取黑名单列表
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const blockedUsers = await prisma.user.findMany({
      where: { isBlocked: true },
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        role: true,
        isBlocked: true,
        blockReason: true,
        blockedAt: true,
      },
      orderBy: { blockedAt: 'desc' },
    });

    res.json({ success: true, users: blockedUsers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '获取黑名单失败' });
  }
});

// 封禁用户
router.post('/:userId', requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId);
  const { reason } = req.body;

  if (!reason || reason.trim() === '') {
    return res.status(400).json({ success: false, message: '请提供封禁原因' });
  }

  if (isNaN(userId)) {
    return res.status(400).json({ success: false, message: '无效的用户ID' });
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });

    if (!target) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    if (target.role === 'ADMIN' || target.role === 'LIBRARIAN') {
      return res.status(403).json({ success: false, message: '只能封禁读者账号，不能封禁管理员或馆员' });
    }

    if (target.isBlocked) {
      return res.status(400).json({ success: false, message: '该用户已在黑名单中' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isBlocked: true,
        blockReason: reason.trim(),
        blockedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        isBlocked: true,
        blockReason: true,
        blockedAt: true,
      },
    });

    await writeAuditLog({
      userId: req.user.id,
      action: 'BLOCK_USER',
      entity: 'User',
      entityId: userId,
      detail: `管理员 ${req.user.email} 封禁用户 ${target.name}(ID:${userId})，原因：${reason.trim()}`,
    });

    res.json({ success: true, message: `用户 ${target.name} 已加入黑名单`, user: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '封禁操作失败' });
  }
});

// 解封用户
router.delete('/:userId', requireAuth, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId);

  if (isNaN(userId)) {
    return res.status(400).json({ success: false, message: '无效的用户ID' });
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });

    if (!target) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    if (!target.isBlocked) {
      return res.status(400).json({ success: false, message: '该用户不在黑名单中' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isBlocked: false,
        blockReason: null,
        blockedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        isBlocked: true,
      },
    });

    await writeAuditLog({
      userId: req.user.id,
      action: 'UNBLOCK_USER',
      entity: 'User',
      entityId: userId,
      detail: `管理员 ${req.user.email} 解封用户 ${target.name}(ID:${userId})`,
    });

    res.json({ success: true, message: `用户 ${target.name} 已从黑名单移除`, user: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '解封操作失败' });
  }
});

module.exports = router;
