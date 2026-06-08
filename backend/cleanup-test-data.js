/**
 * 清除测试数据脚本
 * 运行: node cleanup-test-data.js
 */

const prisma = require('./src/lib/prisma');

async function cleanupTestData() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🧹 清除测试数据');
    console.log('='.repeat(80) + '\n');

    // 1. 删除测试借阅记录（先删除，因为外键依赖 Loan）
    const deletedLoans = await prisma.loan.deleteMany({
      where: {
        barcode: {
          startsWith: 'LN-TEST-',
        },
      },
    });
    console.log(`✓ 已删除 ${deletedLoans.count} 条测试借阅记录`);

    // 2. 删除测试提醒日志（依赖 User，但先删不影响）
    const deletedLogs = await prisma.reminderLog.deleteMany({
      where: {
        user: {
          email: 'hyfceshi@163.com',
        },
      },
    });
    console.log(`✓ 已删除 ${deletedLogs.count} 条测试提醒日志`);

    // 3. 删除站内消息（senderId 或 receiverId 关联到用户）
    const deletedMessages = await prisma.message.deleteMany({
      where: {
        OR: [
          { sender: { email: 'hyfceshi@163.com' } },
          { receiver: { email: 'hyfceshi@163.com' } },
        ],
      },
    });
    console.log(`✓ 已删除 ${deletedMessages.count} 条站内消息`);

    // 4. 删除测试副本
    const deletedCopies = await prisma.copy.deleteMany({
      where: {
        barcode: {
          startsWith: 'TEST-COPY-',
        },
      },
    });
    console.log(`✓ 已删除 ${deletedCopies.count} 条测试副本`);

    // 5. 删除测试图书
    const deletedBooks = await prisma.book.deleteMany({
      where: {
        isbn: {
          startsWith: 'TEST-ISBN-',
        },
      },
    });
    console.log(`✓ 已删除 ${deletedBooks.count} 条测试图书`);

    // 6. 最后删除测试用户（没有外键依赖后才能删）
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        email: 'hyfceshi@163.com',
      },
    });
    console.log(`✓ 已删除 ${deletedUsers.count} 条测试用户`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ 测试数据清理完成！');
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('\n❌ 清理出错:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTestData();