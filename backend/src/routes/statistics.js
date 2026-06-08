const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// 今日借阅数量
router.get('/today-loans', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const count = await prisma.loan.count({
      where: {
        checkoutDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    res.json({
      success: true,
      todayLoans: count,
    });
  } catch (error) {
    console.error('今日借阅统计失败:', error);
    res.status(500).json({ success: false, error: '统计失败' });
  }
});

// 可选：总图书统计
router.get('/total-books', async (req, res) => {
  try {
    const count = await prisma.book.count();
    res.json({ success: true, totalBooks: count });
  } catch (error) {
    res.status(500).json({ success: false, error: '统计失败' });
  }
});

// 可选：在借图书数量
router.get('/active-loans', async (req, res) => {
  try {
    const count = await prisma.loan.count({
      where: {
        returnDate: null,  // 未归还
      },
    });
    res.json({ success: true, activeLoans: count });
  } catch (error) {
    res.status(500).json({ success: false, error: '统计失败' });
  }
});

// 可选：逾期图书数量
router.get('/overdue-loans', async (req, res) => {
  try {
    const now = new Date();
    const count = await prisma.loan.count({
      where: {
        returnDate: null,
        dueDate: {
          lt: now,  // 应还日期小于当前日期
        },
      },
    });
    res.json({ success: true, overdueLoans: count });
  } catch (error) {
    res.status(500).json({ success: false, error: '统计失败' });
  }
});

// 罚款月度统计（已缴纳）
router.get('/fine-stats', async (req, res) => {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT
        strftime('%Y-%m', "updatedAt") AS month,
        SUM("fineAmount") AS totalFine,
        COUNT(*) AS fineCount
      FROM "Loan"
      WHERE "finePaid" = 1 AND "fineAmount" > 0
      GROUP BY strftime('%Y-%m', "updatedAt")
      ORDER BY month ASC
    `);

    // 转换为数字类型（SQLite 返回 BigInt）
    const stats = result.map((row) => ({
      month: row.month,
      totalFine: Number(row.totalFine),
      fineCount: Number(row.fineCount),
    }));

    // 计算总计
    const grandTotal = stats.reduce((sum, s) => sum + s.totalFine, 0);

    res.json({
      success: true,
      stats,
      grandTotal,
    });
  } catch (error) {
    console.error('罚款统计失败:', error);
    res.status(500).json({ success: false, error: '罚款统计失败' });
  }
});

module.exports = router;