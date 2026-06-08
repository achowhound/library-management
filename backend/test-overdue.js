const prisma = require('./src/lib/prisma');
const {
  getFineRatePerDay,
  buildReturnSummary,
} = require('./src/lib/fines');

function formatCurrency(amount) {
  return `¥${Number(amount || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
}

function generateLoanBarcode() {
  const part1 = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  const part2 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `BC-${part1}-${part2}`;
}

async function generateUniqueLoanBarcode() {
  for (let i = 0; i < 10; i += 1) {
    const barcode = generateLoanBarcode();
    const existing = await prisma.loan.findUnique({ where: { barcode } });
    if (!existing) return barcode;
  }
  throw new Error('无法生成唯一借阅条形码');
}

async function printLoanState(title, loanId) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      user: { select: { name: true, email: true, studentId: true } },
      copy: { include: { book: true } },
    },
  });

  console.log(`\n========== ${title} ==========`);
  console.log('借阅ID:', loan.id);
  console.log('借阅码:', loan.barcode);
  console.log('用户:', loan.user.name || loan.user.email, loan.user.studentId ? `(${loan.user.studentId})` : '');
  console.log('图书:', loan.copy.book.title);
  console.log('副本状态:', loan.copy.status);
  console.log('借出时间:', formatDate(loan.checkoutDate));
  console.log('应还时间:', formatDate(loan.dueDate));
  console.log('归还时间:', formatDate(loan.returnDate));
  console.log('罚款金额:', formatCurrency(loan.fineAmount));
  console.log('是否已缴费:', loan.finePaid ? '是' : '否');
  console.log('是否免罚:', loan.fineForgiven ? '是' : '否');

  return loan;
}

async function getFineSalaryStats() {
  const paidFineLoans = await prisma.loan.findMany({
    where: {
      finePaid: true,
      fineAmount: { gt: 0 },
    },
    select: { fineAmount: true },
  });
  const librarianCount = await prisma.user.count({ where: { role: 'LIBRARIAN' } });
  const totalFineAmount = paidFineLoans.reduce((sum, loan) => sum + Number(loan.fineAmount || 0), 0);
  const salaryPerLibrarian = librarianCount > 0
    ? Math.round((totalFineAmount / librarianCount + Number.EPSILON) * 100) / 100
    : 0;

  return {
    totalRecords: paidFineLoans.length,
    totalFineAmount,
    librarianCount,
    salaryPerLibrarian,
  };
}

function printStats(title, stats) {
  console.log(`\n========== ${title} ==========`);
  console.log('已缴罚款记录数:', stats.totalRecords);
  console.log('已缴罚款总额:', formatCurrency(stats.totalFineAmount));
  console.log('馆员人数:', stats.librarianCount);
  console.log('每位馆员工资:', formatCurrency(stats.salaryPerLibrarian));
}

async function runOverdueFinePaymentExample() {
  try {
    const user = await prisma.user.findFirst({
      where: { role: 'STUDENT' },
      orderBy: { id: 'asc' },
    });
    if (!user) {
      console.log('❌ 没有找到学生用户，请先创建学生账号');
      return;
    }

    const copy = await prisma.copy.findFirst({
      where: { status: 'AVAILABLE' },
      include: { book: true },
      orderBy: { id: 'asc' },
    });
    if (!copy) {
      console.log('❌ 没有找到可借图书副本，请先添加可用副本');
      return;
    }

    const beforeStats = await getFineSalaryStats();
    printStats('缴费前工资统计', beforeStats);

    const checkoutDate = new Date();
    checkoutDate.setDate(checkoutDate.getDate() - 10);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - 5);

    const loan = await prisma.loan.create({
      data: {
        userId: user.id,
        copyId: copy.id,
        barcode: await generateUniqueLoanBarcode(),
        checkoutDate,
        dueDate,
        fineAmount: 0,
        finePaid: false,
        fineForgiven: false,
        renewCount: 0,
      },
    });

    await prisma.copy.update({
      where: { id: copy.id },
      data: { status: 'BORROWED' },
    });

    await printLoanState('创建逾期借阅后，缴费前状态', loan.id);

    const fineRatePerDay = await getFineRatePerDay();
    const returnDate = new Date();
    const loanBeforePayment = await prisma.loan.findUnique({
      where: { id: loan.id },
      include: { copy: { include: { book: true } }, user: true },
    });
    const returnSummary = buildReturnSummary(loanBeforePayment, returnDate, fineRatePerDay, {
      waiveFine: false,
    });

    console.log('\n========== 模拟用户缴纳逾期罚款 ==========');
    console.log('罚款规则:', `${formatCurrency(fineRatePerDay)} / 天`);
    console.log('逾期天数:', returnSummary.overdueDays, '天');
    console.log('本次应缴罚款:', formatCurrency(returnSummary.fineAmount));

    await prisma.$transaction(async (tx) => {
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          returnDate,
          fineAmount: returnSummary.fineAmount,
          finePaid: returnSummary.fineAmount > 0,
          fineForgiven: false,
        },
      });

      await tx.copy.update({
        where: { id: copy.id },
        data: { status: 'AVAILABLE' },
      });
    });

    await printLoanState('缴费并自动归还后状态', loan.id);

    const afterStats = await getFineSalaryStats();
    printStats('缴费后工资统计', afterStats);

    console.log('\n========== 本次变化 ==========');
    console.log('罚款总额增加:', formatCurrency(afterStats.totalFineAmount - beforeStats.totalFineAmount));
    console.log('每位馆员工资增加:', formatCurrency(afterStats.salaryPerLibrarian - beforeStats.salaryPerLibrarian));
    console.log('✅ 测试完成：finePaid 从 false 变为 true，returnDate 被写入，副本状态从 BORROWED 变回 AVAILABLE，工资统计同步变化');
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runOverdueFinePaymentExample();
