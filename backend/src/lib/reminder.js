/**
 * 图书到期提醒服务
 * 处理图书到期提醒的核心业务逻辑
 */

const prisma = require('./prisma');
const { sendDueReminderEmail } = require('./email');
const bcrypt = require('bcrypt');

/**
 * 检查并发送图书到期提醒
 * 筛选条件：
 * 1. 借阅图书剩余到期时间 <= 3天
 * 2. 图书未办理续借（returnDate 为 null）
 * 3. 今天之前没有发送过提醒（检查ReminderLog）
 *    - 当 force = true 时，忽略今日已发送记录，允许再次发送
 *
 * @param {Object} options
 * @param {boolean} options.force - 是否强制再次发送
 * @returns {Promise<Object>} 执行结果
 */
async function sendSystemMessage({ receiverId, content }) {
  try {
    const systemEmail = 'system@library.local';
    let systemUser = await prisma.user.findUnique({
      where: { email: systemEmail },
    });

    if (!systemUser) {
      const passwordHash = await bcrypt.hash('system-placeholder-password', 10);
      systemUser = await prisma.user.create({
        data: {
          name: '图书馆系统',
          email: systemEmail,
          passwordHash,
          role: 'ADMIN',
        },
      });
      console.log('✅ 创建系统消息用户成功');
    }

    await prisma.message.create({
      data: {
        senderId: systemUser.id,
        receiverId,
        content,
      },
    });

    console.log(`💬 站内消息发送成功: 用户 ${receiverId}`);
    return { success: true };
  } catch (error) {
    console.error('发送站内消息失败:', error.message);
    return { success: false, error: error.message };
  }
}

async function checkAndSendReminders({ force = false } = {}) {
  const startTime = new Date();
  console.log(`\n🔔 开始执行图书到期提醒任务: ${startTime.toLocaleString('zh-CN')}`);

  try {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const loansNeedReminder = await prisma.loan.findMany({
      where: {
        returnDate: null,
        dueDate: {
          lte: threeDaysLater,
          gte: now,
        },
      },
      include: {
        user: true,
        copy: {
          include: {
            book: true,
          },
        },
      },
    });

    console.log(`📊 找到 ${loansNeedReminder.length} 条需要提醒的借阅记录`);

    if (loansNeedReminder.length === 0) {
      return {
        success: true,
        message: '没有需要提醒的借阅记录',
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    let successCount = 0;
    let failureCount = 0;

    for (const loan of loansNeedReminder) {
      try {
        const todayReminder = await prisma.reminderLog.findFirst({
          where: {
            loanId: loan.id,
            sendStatus: 'success',
            sendTime: {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
              lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
            },
          },
        });

        if (todayReminder && !force) {
          console.log(`⏭️  跳过 (已在今日发送过): 用户${loan.user.name} - ${loan.copy.book.title}`);
          continue;
        }

        if (todayReminder && force) {
          console.log(`🔁  强制重新发送提醒: 用户${loan.user.name} - ${loan.copy.book.title}`);
        }

        if (loan.user.isBlocked) {
          console.log(`⏭️  跳过 (用户被屏蔽): ${loan.user.name}`);
          continue;
        }

        if (!loan.user.email) {
          console.log(`⏭️  跳过 (用户邮箱无效): ${loan.user.name}`);
          continue;
        }

        const dueDateFormatted = new Date(loan.dueDate).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const messageContent = `📚 图书到期提醒\n\n您借阅的图书《${loan.copy.book.title}》将于 ${dueDateFormatted} 到期。\n请及时归还或办理续借，避免产生逾期费用。\n\n如已续借，请忽略此消息。`;

        // 并行执行邮件发送和站内消息发送
        const [emailResult, messageResult] = await Promise.all([
          // 发送邮件
          sendDueReminderEmail({
            email: loan.user.email,
            readerName: loan.user.name,
            bookTitle: loan.copy.book.title,
            dueDate: loan.dueDate,
          }),
          // 发送站内消息
          sendSystemMessage({
            receiverId: loan.userId,
            content: messageContent,
          }),
        ]);

        await prisma.reminderLog.create({
          data: {
            userId: loan.userId,
            loanId: loan.id,
            bookTitle: loan.copy.book.title,
            dueDate: loan.dueDate,
            sendStatus: emailResult.success ? 'success' : 'failed',
            sendTime: new Date(),
            errorMessage: emailResult.error || null,
          },
        });

        if (emailResult.success) {
          successCount++;
          console.log(`✅ 邮件发送成功: ${loan.user.name} - ${loan.copy.book.title}`);
        } else {
          failureCount++;
          console.log(`❌ 发送失败: ${loan.user.name} - ${emailResult.error}`);
        }
      } catch (error) {
        failureCount++;
        console.error(`❌ 处理出错 (用户ID: ${loan.userId}):`, error.message);

        try {
          await prisma.reminderLog.create({
            data: {
              userId: loan.userId,
              loanId: loan.id,
              bookTitle: loan.copy.book.title,
              dueDate: loan.dueDate,
              sendStatus: 'failed',
              sendTime: new Date(),
              errorMessage: error.message,
            },
          });
        } catch (logError) {
          console.error('记录日志失败:', logError.message);
        }
      }
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    console.log(`\n📈 任务执行完成`);
    console.log(`  - 处理记录数: ${loansNeedReminder.length}`);
    console.log(`  - 成功发送: ${successCount}`);
    console.log(`  - 发送失败: ${failureCount}`);
    console.log(`  - 耗时: ${duration.toFixed(2)}秒`);

    return {
      success: true,
      message: '提醒任务执行完成',
      totalProcessed: loansNeedReminder.length,
      successCount,
      failureCount,
      duration: `${duration.toFixed(2)}秒`,
    };
  } catch (error) {
    console.error('❌ 提醒任务执行失败:', error.message);
    return {
      success: false,
      message: '提醒任务执行失败',
      error: error.message,
    };
  }
}

/**
 * 获取提醒日志列表
 * @param {Object} options - 查询选项
 * @param {number} options.page - 页码（默认1）
 * @param {number} options.pageSize - 每页记录数（默认20）
 * @param {string} options.status - 发送状态筛选（success/failed/all）
 * @param {number} options.userId - 用户ID筛选
 * @returns {Promise<Object>} 日志列表和分页信息
 */
async function getReminderLogs({
  page = 1,
  pageSize = 20,
  status = 'all',
  userId = null,
} = {}) {
  try {
    const where = {};

    if (status !== 'all') {
      where.sendStatus = status;
    }

    if (userId) {
      where.userId = userId;
    }

    const total = await prisma.reminderLog.count({ where });

    const logs = await prisma.reminderLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            studentId: true,
          },
        },
        loan: {
          select: {
            id: true,
            barcode: true,
            dueDate: true,
            returnDate: true,
          },
        },
      },
      orderBy: {
        sendTime: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      success: true,
      data: logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error('获取提醒日志失败:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 获取用户的提醒统计
 * @param {number} userId - 用户ID
 * @returns {Promise<Object>} 统计信息
 */
async function getUserReminderStats(userId) {
  try {
    const totalReminders = await prisma.reminderLog.count({
      where: { userId },
    });

    const successCount = await prisma.reminderLog.count({
      where: { userId, sendStatus: 'success' },
    });

    const failureCount = await prisma.reminderLog.count({
      where: { userId, sendStatus: 'failed' },
    });

    const recentReminders = await prisma.reminderLog.findMany({
      where: { userId },
      include: {
        loan: {
          include: {
            copy: {
              include: {
                book: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { sendTime: 'desc' },
      take: 5,
    });

    return {
      success: true,
      data: {
        userId,
        totalReminders,
        successCount,
        failureCount,
        successRate: totalReminders > 0 ? ((successCount / totalReminders) * 100).toFixed(2) + '%' : '0%',
        recentReminders,
      },
    };
  } catch (error) {
    console.error('获取用户提醒统计失败:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  checkAndSendReminders,
  getReminderLogs,
  getUserReminderStats,
};
