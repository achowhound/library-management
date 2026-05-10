const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const {
  getFineRatePerDay,
  calculateOverdueSummary,
  buildReturnSummary,
} = require('../lib/fines');

const router = express.Router();
const prisma = new PrismaClient();

const MAX_BORROW_LIMIT = 5;
const MAX_RENEW_COUNT = 2;
const RENEW_DAYS = 14;

// 获取我的借阅列表（包括已归还和未归还）
router.get('/my-borrows', requireAuth, async (req, res) => {
  try {
    const fineRatePerDay = await getFineRatePerDay();
    const loans = await prisma.loan.findMany({
      where: { userId: req.user.id },
      include: {
        copy: {
          include: { book: true }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    // 为每条借阅记录添加罚款计算
    const loansWithFine = loans.map(loan => {
      const referenceDate = loan.returnDate ? loan.returnDate : new Date();
      const overdueSummary = calculateOverdueSummary(loan.dueDate, referenceDate, fineRatePerDay);
      const storedFineAmount = Number(loan.fineAmount ?? 0);
      const fineForgiven = Boolean(loan.fineForgiven);
      const estimatedFineAmount = loan.returnDate
        ? (Number.isFinite(storedFineAmount) ? storedFineAmount : 0)
        : overdueSummary.estimatedFineAmount;

      return {
        ...loan,
        fineForgiven,
        isOverdue: loan.returnDate
          ? overdueSummary.overdueDays > 0 || fineForgiven || estimatedFineAmount > 0
          : overdueSummary.isOverdue,
        overdueDays: overdueSummary.overdueDays,
        estimatedFineAmount,
      };
    });

    res.json({ loans: loansWithFine });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取借阅列表失败' });
  }
});

// 获取可借副本列表
router.get('/available-copies/:bookId', requireAuth, async (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId);
    const copies = await prisma.copy.findMany({
      where: {
        bookId: bookId,
        status: 'AVAILABLE'
      },
      select: {
        id: true,
        barcode: true,
        floor: true,
        libraryArea: true,
        shelfNo: true,
        shelfLevel: true
      }
    });
    res.json({ copies });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '获取副本列表失败' });
  }
});

// 借阅图书（选择具体副本）
router.post('/borrow/:copyId', requireAuth, async (req, res) => {
  try {
    const copyId = parseInt(req.params.copyId);

    const copy = await prisma.copy.findUnique({
      where: { id: copyId },
      include: { book: true }
    });

    if (!copy) {
      return res.status(404).json({ message: '副本不存在' });
    }

    if (copy.status !== 'AVAILABLE') {
      return res.status(400).json({ message: '该副本不可借' });
    }

    const currentCount = await prisma.loan.count({
      where: { userId: req.user.id, returnDate: null }
    });
    if (currentCount >= MAX_BORROW_LIMIT) {
      return res.status(400).json({ message: `最多同时借阅${MAX_BORROW_LIMIT}本书` });
    }

    const existingLoan = await prisma.loan.findFirst({
      where: {
        userId: req.user.id,
        copy: { bookId: copy.bookId },
        returnDate: null
      }
    });
    if (existingLoan) {
      return res.status(400).json({ message: '您已借阅过这本书，请先归还' });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const loan = await prisma.loan.create({
      data: {
        copyId: copyId,
        userId: req.user.id,
        dueDate: dueDate,
        fineAmount: 0,
        finePaid: false,
        fineForgiven: false,
        renewCount: 0
      },
      include: {
        copy: {
          include: { book: true }
        }
      }
    });

    await prisma.copy.update({
      where: { id: copyId },
      data: { status: 'BORROWED' }
    });

    res.status(201).json({
      message: '借阅成功',
      loan: {
        id: loan.id,
        bookTitle: loan.copy.book.title,
        barcode: loan.copy.barcode,
        dueDate: loan.dueDate
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '借阅失败' });
  }
});

// 续借图书 - 使用 copyId
router.post('/renew', requireAuth, async (req, res) => {
  try {
    const { copyId } = req.body;

    if (!copyId) {
      return res.status(400).json({ message: '请提供副本ID' });
    }

    const loan = await prisma.loan.findFirst({
      where: {
        copyId: parseInt(copyId),
        userId: req.user.id,
        returnDate: null
      }
    });

    if (!loan) {
      return res.status(404).json({ message: '借阅记录不存在' });
    }

    const currentRenewCount = loan.renewCount || 0;
    if (currentRenewCount >= MAX_RENEW_COUNT) {
      return res.status(400).json({ message: `续借次数已达上限（最多${MAX_RENEW_COUNT}次）` });
    }

    const newDueDate = new Date(loan.dueDate);
    newDueDate.setDate(newDueDate.getDate() + RENEW_DAYS);

    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        dueDate: newDueDate,
        renewCount: currentRenewCount + 1
      }
    });

    res.json({
      success: true,
      message: '续借成功',
      newDueDate: newDueDate,
      renewCount: currentRenewCount + 1
    });
  } catch (error) {
    console.error('续借错误:', error);
    res.status(500).json({ message: '续借失败' });
  }
});

// 归还图书（读者自还）
router.post('/return/:loanId', requireAuth, async (req, res) => {
  try {
    const loanId = parseInt(req.params.loanId);

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId: req.user.id, returnDate: null },
      include: { copy: { include: { book: true } } }
    });

    if (!loan) {
      return res.status(404).json({ success: false, message: '借阅记录不存在或已归还' });
    }

    // 计算罚款
    const fineRatePerDay = await getFineRatePerDay();
    const returnDate = new Date();
    const returnSummary = buildReturnSummary(loan, returnDate, fineRatePerDay, { waiveFine: false });

    // 更新借阅记录（包括罚款金额）
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        returnDate: returnDate,
        fineAmount: returnSummary.fineAmount,
        finePaid: returnSummary.fineAmount > 0 ? false : loan.finePaid,
        fineForgiven: returnSummary.fineForgiven,
      }
    });

    // 更新副本状态
    await prisma.copy.update({
      where: { id: loan.copyId },
      data: { status: 'AVAILABLE' }
    });

    let message = `《${loan.copy.book.title}》已成功归还`;
    if (returnSummary.fineAmount > 0) {
      message += `，逾期罚款 ¥${returnSummary.fineAmount.toFixed(2)}`;
    }

    res.json({
      success: true,
      message,
      loan: {
        id: updatedLoan.id,
        fineAmount: Number(updatedLoan.fineAmount ?? 0),
        finePaid: updatedLoan.finePaid,
        bookTitle: loan.copy.book.title,
      }
    });
  } catch (error) {
    console.error('归还图书错误:', error);
    res.status(500).json({ success: false, message: '归还失败' });
  }
});

// 支付罚款
router.post('/pay-fine/:loanId', requireAuth, async (req, res) => {
  try {
    const loanId = parseInt(req.params.loanId);
    const { paymentMethod } = req.body;

    // 验证借阅记录是否存在且属于当前用户
    const loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        userId: req.user.id
      },
      include: {
        copy: {
          include: {
            book: true
          }
        }
      }
    });

    if (!loan) {
      return res.status(404).json({ 
        success: false,
        message: '借阅记录不存在或不属于当前用户' 
      });
    }

    // 检查是否有罚款需要支付
    if (!loan.fineAmount || loan.fineAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: '该借阅记录没有罚款需要支付'
      });
    }

    if (loan.finePaid) {
      return res.status(400).json({
        success: false,
        message: '罚款已经支付'
      });
    }

    // 更新罚款支付状态
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        finePaid: true,
        fineForgiven: false
      },
      include: {
        copy: {
          include: {
            book: true
          }
        }
      }
    });

    // 记录支付日志
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true }
      });
      
      await prisma.auditLog.create({
        data: {
          action: 'FINE_PAYMENT',
          details: `用户 ${user?.name || '未知'} 使用${paymentMethod === 'wechat' ? '微信支付' : '支付宝'}支付了借阅记录 ${loanId} 的罚款 ¥${loan.fineAmount.toFixed(2)}`,
          userId: req.user.id,
          targetId: loanId.toString(),
          targetType: 'LOAN'
        }
      });
    } catch (logError) {
      console.warn('记录支付日志失败:', logError);
    }

    res.json({
      success: true,
      message: '罚款支付成功',
      loan: {
        id: updatedLoan.id,
        bookTitle: updatedLoan.copy.book.title,
        fineAmount: updatedLoan.fineAmount,
        finePaid: updatedLoan.finePaid,
        paidAt: new Date().toISOString(),
        paymentMethod
      }
    });

  } catch (error) {
    console.error('支付罚款失败:', error);
    res.status(500).json({
      success: false,
      message: '支付失败，请稍后重试'
    });
  }
});



module.exports = router;