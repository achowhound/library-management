const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const {
  getFineRatePerDay,
  decorateLoanWithFine,
  buildReturnSummary,
} = require('../lib/fines');

// 引入支付宝 SDK
const alipaySdk = require('./alipay');
const buildPagePayUrl = alipaySdk.buildPagePayUrl;
const { getAlipayReturnUrl, getAlipayNotifyUrl, getFrontendUrl } = alipaySdk;


const router = express.Router();

const MAX_BORROW_LIMIT = 5;

// 生成借阅条形码 BC-xxxxxx-xxx 格式
function generateLoanBarcode() {
  const part1 = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  const part2 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `BC-${part1}-${part2}`;
}

// 生成唯一的借阅条形码
async function generateUniqueBarcode() {
  let barcode;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    barcode = generateLoanBarcode();
    attempts++;
    const existing = await prisma.loan.findUnique({ where: { barcode } });
    if (!existing) return barcode;
  } while (attempts < maxAttempts);
  
  throw new Error('无法生成唯一的条形码');
}
const MAX_RENEW_COUNT = 2;
const RENEW_DAYS = 14;

async function writeAuditLog(data) {
  try {
    await prisma.auditLog.create({ data });
  } catch (error) {
    console.warn('Failed to write audit log:', error.message);
  }
}

function parseLoanIdFromOutTradeNo(outTradeNo) {
  const underscored = outTradeNo.match(/^FINE_(\d+)_\d+$/);
  if (underscored) return parseInt(underscored[1], 10);

  // 兼容旧格式 FINE{loanId}{13位时间戳}，如 FINE151780239870831
  const compact = outTradeNo.match(/^FINE(\d+?)(\d{13})$/);
  if (compact) return parseInt(compact[1], 10);

  return NaN;
}

async function completeReturnAfterFinePaid(loanId) {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, returnDate: null },
    include: { copy: { include: { book: true } }, user: true },
  });
  if (!loan) return;

  const fineRatePerDay = await getFineRatePerDay();
  const returnDate = new Date();
  const returnSummary = buildReturnSummary(loan, returnDate, fineRatePerDay, { waiveFine: false });

  await prisma.loan.update({
    where: { id: loanId },
    data: {
      returnDate,
      fineAmount: returnSummary.fineAmount,
      finePaid: returnSummary.fineAmount > 0 ? true : loan.finePaid,
      fineForgiven: returnSummary.fineForgiven,
    },
  });

  await prisma.copy.update({
    where: { id: loan.copyId },
    data: { status: 'AVAILABLE' },
  });

  writeAuditLog({
    userId: loan.userId,
    action: 'RETURN_BOOK',
    entity: 'Loan',
    entityId: loanId,
    detail: `读者 ${loan.user.email} 支付罚款后自动还书(借阅记录 ${loanId})，罚款 ¥${returnSummary.fineAmount.toFixed(2)}`,
  });
}

async function markFineAsPaid(loanId, amount, source) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { user: true },
  });
  if (!loan) {
    console.error(`markFineAsPaid: 借阅记录 ${loanId} 不存在，请检查订单号解析是否正确`);
    return false;
  }

  await prisma.loan.update({
    where: { id: loanId },
    data: {
      finePaid: true,
      fineForgiven: false,
    },
  });

  writeAuditLog({
    userId: loan.userId,
    action: 'FINE_PAYMENT',
    entity: 'Loan',
    entityId: loanId,
    detail: `用户通过支付宝(${source})支付了借阅记录 ${loanId} 的罚款 ¥${amount}`,
  });

  if (!loan.returnDate) {
    await completeReturnAfterFinePaid(loanId);
  }

  return true;
}

async function handlePayFine(req, res) {
  try {
    const loanId = parseInt(req.params.loanId);

    let loan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        userId: req.user.id,
      },
      include: {
        copy: {
          include: {
            book: true,
          },
        },
      },
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: '借阅记录不存在或不属于当前用户',
      });
    }

    if (loan.finePaid) {
      return res.status(400).json({
        success: false,
        message: '罚款已经支付',
      });
    }

    let calculatedFineAmount = Number(loan.fineAmount || 0);
    if (!loan.returnDate) {
      const fineRatePerDay = await getFineRatePerDay();
      const returnDate = new Date();
      const returnSummary = buildReturnSummary(loan, returnDate, fineRatePerDay, { waiveFine: false });
      calculatedFineAmount = returnSummary.fineAmount;

      await prisma.loan.update({
        where: { id: loanId },
        data: {
          fineAmount: calculatedFineAmount,
          finePaid: false,
          fineForgiven: returnSummary.fineForgiven,
        },
      });
    }

    if (!calculatedFineAmount || calculatedFineAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: '该借阅记录没有罚款需要支付',
      });
    }

    loan = { ...loan, fineAmount: calculatedFineAmount };

    const outTradeNo = `FINE_${loanId}_${Date.now()}`;
    const notifyUrl = getAlipayNotifyUrl();
    const returnUrl = getAlipayReturnUrl();

    if (process.env.ALIPAY_MOCK_PAY === 'true') {
      await markFineAsPaid(loanId, loan.fineAmount.toFixed(2), 'mock');
      console.log('⚠️ ALIPAY_MOCK_PAY 已开启，跳过真实支付');
      return res.redirect(`${getFrontendUrl()}/history?fine_paid=1&out_trade_no=${outTradeNo}`);
    }

    const payParams = {
      bizContent: {
        outTradeNo,
        productCode: 'FAST_INSTANT_TRADE_PAY',
        totalAmount: loan.fineAmount.toFixed(2),
        subject: `LibraryFine${loanId}`,
        body: `Loan ${loanId} overdue fine`,
      },
      returnUrl,
    };

    if (notifyUrl) {
      payParams.notifyUrl = notifyUrl;
    } else {
      console.warn('⚠️ ALIPAY_NOTIFY_URL 未配置，将仅依赖支付回跳同步确认');
    }

    console.log('开始生成支付链接...', {
      loanId,
      fineAmount: loan.fineAmount.toFixed(2),
      outTradeNo,
      returnUrl,
      notifyUrl: notifyUrl || '(未配置)',
    });

    const payUrl = buildPagePayUrl('alipay.trade.page.pay', payParams);
    res.redirect(payUrl);
  } catch (error) {
    console.error('支付失败:', error);
    res.status(500).json({
      success: false,
      message: '支付失败，请稍后重试',
    });
  }
}

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
    // 使用罚款计算逻辑装饰借阅记录
    const decoratedLoans = loans.map((loan) => decorateLoanWithFine(loan, fineRatePerDay));
    res.json({ loans: decoratedLoans });
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
  if (req.user.isBlocked) {
    return res.status(403).json({ message: `您的账号已被封禁，无法借阅书籍。封禁原因：${req.user.blockReason || '违反图书馆相关规定'}` });
  }

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

    const barcode = await generateUniqueBarcode();
    
    const loan = await prisma.loan.create({
      data: {
        copyId: copyId,
        userId: req.user.id,
        barcode,
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

    writeAuditLog({
      userId: req.user.id,
      action: 'BORROW_BOOK',
      entity: 'Loan',
      entityId: loan.id,
      detail: `读者 ${req.user.email} 自助借阅《${loan.copy.book.title}》(副本 ${copyId})`,
    });

    res.status(201).json({
      message: '借阅成功',
      loan: {
        id: loan.id,
        barcode: loan.barcode,
        bookTitle: loan.copy.book.title,
        copyBarcode: loan.copy.barcode,
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
  if (req.user.isBlocked) {
    return res.status(403).json({ message: `您的账号已被封禁，无法续借书籍。封禁原因：${req.user.blockReason || '违反图书馆相关规定'}` });
  }

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

    writeAuditLog({
      userId: req.user.id,
      action: 'RENEW_LOAN',
      entity: 'Loan',
      entityId: loan.id,
      detail: `读者 ${req.user.email} 续借了借阅记录 ${loan.id}，新到期日 ${newDueDate.toISOString().slice(0, 10)}`,
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

// 归还图书
router.post('/return/:loanId', requireAuth, async (req, res) => {
  try {
    const loanId = parseInt(req.params.loanId);

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId: req.user.id, returnDate: null },
      include: { copy: { include: { book: true } }, user: true }
    });

    if (!loan) {
      return res.status(404).json({ success: false, message: '借阅记录不存在或已归还' });
    }

    // 获取罚款率并计算罚款
    const fineRatePerDay = await getFineRatePerDay();
    const returnDate = new Date();
    const returnSummary = buildReturnSummary(loan, returnDate, fineRatePerDay, { waiveFine: false });

    // 更新借阅记录，设置归还日期和罚款金额
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        returnDate: returnDate,
        fineAmount: returnSummary.fineAmount,
        finePaid: returnSummary.fineAmount > 0 ? Boolean(loan.finePaid) : true,
        fineForgiven: returnSummary.fineForgiven,
      },
      include: {
        copy: { include: { book: true } }
      }
    });

    await prisma.copy.update({
      where: { id: loan.copyId },
      data: { status: 'AVAILABLE' }
    });

    let message = `《${loan.copy.book.title}》已成功归还`;
    if (returnSummary.fineAmount > 0) {
      message += `，逾期罚款 ¥${returnSummary.fineAmount.toFixed(2)}`;
    }

    writeAuditLog({
      userId: req.user.id,
      action: 'RETURN_BOOK',
      entity: 'Loan',
      entityId: loanId,
      detail: `读者 ${req.user.email} 自助还书(借阅记录 ${loanId})，罚款 ¥${returnSummary.fineAmount.toFixed(2)}`,
    });

    res.json({
      success: true,
      message: message,
      loan: {
        id: updatedLoan.id,
        bookTitle: updatedLoan.copy.book.title,
        returnDate: updatedLoan.returnDate,
        fineAmount: Number(updatedLoan.fineAmount ?? 0),
        finePaid: Boolean(updatedLoan.finePaid),
        fineForgiven: Boolean(updatedLoan.fineForgiven),
        isOverdue: returnSummary.isOverdue,
        overdueDays: returnSummary.overdueDays,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '归还失败' });
  }
});

// 支付宝同步回跳（公网 HTTPS，再转发到本地前端）
router.get('/alipay-return', (req, res) => {
  const query = new URLSearchParams(req.query);
  const target = new URL('/history', getFrontendUrl());
  query.forEach((value, key) => target.searchParams.set(key, value));
  res.redirect(target.toString());
});

// 支付回跳后主动查询订单状态（notify 不可用时的兜底，须在 :loanId 之前注册）
router.post('/pay-fine/sync', requireAuth, async (req, res) => {
  try {
    const { outTradeNo } = req.body;

    if (!outTradeNo || !outTradeNo.startsWith('FINE')) {
      return res.status(400).json({ success: false, message: '无效的订单号' });
    }

    const loanId = parseLoanIdFromOutTradeNo(outTradeNo);
    if (!loanId) {
      return res.status(400).json({ success: false, message: '无效的订单号' });
    }

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId: req.user.id },
    });

    if (!loan) {
      return res.status(404).json({ success: false, message: '借阅记录不存在' });
    }

    if (loan.finePaid) {
      return res.json({ success: true, paid: true, alreadyPaid: true });
    }

    const result = await alipaySdk.exec('alipay.trade.query', {
      bizContent: { outTradeNo },
    });

    const tradeStatus = result.tradeStatus;
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      await markFineAsPaid(loanId, result.totalAmount || loan.fineAmount, 'sync');
      return res.json({ success: true, paid: true });
    }

    return res.json({
      success: false,
      paid: false,
      status: tradeStatus,
      message: '支付尚未完成，请稍后再试',
    });
  } catch (error) {
    console.error('同步支付状态失败:', error);
    res.status(500).json({ success: false, message: '查询支付状态失败' });
  }
});

// 支付罚款（GET 用于浏览器直接跳转，POST 保留兼容）
router.get('/pay-fine/:loanId', requireAuth, handlePayFine);
router.post('/pay-fine/:loanId', requireAuth, handlePayFine);

// 支付宝异步通知接口
router.post('/alipay-notify', async (req, res) => {
  try {
    console.log('\n========== 支付宝异步通知报文 ==========');
    console.log('请求体内容:', JSON.stringify(req.body, null, 2));
    console.log('==========================================\n');

    const verifyResult = alipaySdk.checkNotifySignV2(req.body);

    console.log('签名验证结果:', verifyResult);

    if (!verifyResult) {
      console.error('支付宝签名验证失败');
      return res.status(400).send('sign error');
    }

    const { out_trade_no, trade_status, total_amount } = req.body;

    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      const loanId = parseLoanIdFromOutTradeNo(out_trade_no);
      if (!loanId) {
        console.error('无法从订单号解析 loanId:', out_trade_no);
        return res.status(400).send('invalid out_trade_no');
      }
      const ok = await markFineAsPaid(loanId, total_amount, 'notify');
      if (!ok) {
        return res.status(400).send('loan not found');
      }
      console.log(`罚款支付成功: 订单号 ${out_trade_no}, 金额 ¥${total_amount}`);
    }

    res.send('success');
  } catch (error) {
    console.error('支付宝通知处理失败:', error);
    res.status(500).send('error');
  }
});

module.exports = router;