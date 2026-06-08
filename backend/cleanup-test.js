/**
 * 清理测试数据脚本
 * 运行: node cleanup-test.js
 */

const prisma = require('./src/lib/prisma');

async function cleanupTestData() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🗑️  清理测试数据');
    console.log('='.repeat(60));

    // 先查询测试用户ID
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: 'test-reminder@library.com' },
          { email: 'yifei20050426@gmail.com' },
          { studentId: { startsWith: 'TEST-' } },
        ],
      },
      select: { id: true },
    });
    const testUserIds = testUsers.map(u => u.id);

    // 删除测试用户相关的消息
    if (testUserIds.length > 0) {
      const deletedMessages = await prisma.message.deleteMany({
        where: {
          OR: [
            { senderId: { in: testUserIds } },
            { receiverId: { in: testUserIds } },
          ],
        },
      });
      console.log(`✓ 删除测试用户消息: ${deletedMessages.count} 条`);
    }

    // 删除测试借阅记录
    const deletedLoans = await prisma.loan.deleteMany({
      where: {
        barcode: {
          startsWith: 'LN-TEST-',
        },
      },
    });
    console.log(`✓ 删除测试借阅记录: ${deletedLoans.count} 条`);

    // 删除测试副本
    const deletedCopies = await prisma.copy.deleteMany({
      where: {
        barcode: {
          startsWith: 'TEST-COPY-',
        },
      },
    });
    console.log(`✓ 删除测试副本: ${deletedCopies.count} 条`);

    // 删除测试图书
    const deletedBooks = await prisma.book.deleteMany({
      where: {
        isbn: {
          startsWith: 'TEST-ISBN-',
        },
      },
    });
    console.log(`✓ 删除测试图书: ${deletedBooks.count} 条`);

    // 删除测试用户相关的提醒日志
    const deletedLogs = await prisma.reminderLog.deleteMany({
      where: {
        OR: [
          { userId: { in: testUserIds } },
          { bookTitle: { startsWith: '测试图书:' } },
        ],
      },
    });
    console.log(`✓ 删除测试提醒日志: ${deletedLogs.count} 条`);

    // 删除测试用户相关的逾期提醒日志（只按 userId 删除）
    if (testUserIds.length > 0) {
      const deletedDueLogs = await prisma.dueReminderLog.deleteMany({
        where: {
          userId: { in: testUserIds },
        },
      });
      console.log(`✓ 删除测试逾期提醒日志: ${deletedDueLogs.count} 条`);
    }

    // 删除测试用户
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        OR: [
          { email: 'test-reminder@library.com' },
          { email: 'yifei20050426@gmail.com' },
          { studentId: { startsWith: 'TEST-' } },
        ],
      },
    });
    console.log(`✓ 删除测试用户: ${deletedUsers.count} 条`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 测试数据清理完成！');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ 清理出错:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTestData();
