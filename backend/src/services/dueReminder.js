const nodemailer = require('nodemailer');
const prisma = require('../lib/prisma');

const REMINDER_DAYS = Number(process.env.DUE_REMINDER_DAYS || '3');
const REMINDER_EMAIL_FROM = process.env.EMAIL_FROM || '图书馆 <no-reply@library.local>';
const REMINDER_EMAIL_SUBJECT = process.env.EMAIL_SUBJECT || '图书到期提醒';
const REMINDER_SCHEDULE_HOUR = Number(process.env.DUE_REMINDER_HOUR || '5');
const REMINDER_SCHEDULE_MINUTE = Number(process.env.DUE_REMINDER_MINUTE || '0');

let transporterInstance = null;

async function createTransporter() {
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 验证 SMTP 连接配置是否可用（提高可观测性）
    try {
      await transporter.verify();
      console.log('✅ SMTP transporter verified successfully');
    } catch (err) {
      console.warn('⚠️ SMTP transporter verification failed:', err.message || err);
    }

    return transporter;
  }

  console.warn('⚠️ 邮件服务未配置，已使用 Ethereal 测试邮箱发送提醒。请在生产环境中配置 EMAIL_HOST/EMAIL_USER/EMAIL_PASS。');
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

async function getTransporter() {
  if (!transporterInstance) {
    transporterInstance = await createTransporter();
  }
  return transporterInstance;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function buildEmailTemplate(loan) {
  const bookName = loan.copy?.book?.title || '未知图书';
  const dueDate = formatDate(loan.dueDate);
  return {
    subject: `${REMINDER_EMAIL_SUBJECT}：${bookName} 将于 ${dueDate} 到期`,
    text: `尊敬的读者，\n\n您借阅的图书《${bookName}》将于 ${dueDate} 到期。\n请在到期前归还或办理续借，以避免产生逾期费用。\n\n如已续借，请忽略此邮件。\n\n祝好，\n图书馆`,
    html: `<p>尊敬的读者，</p><p>您借阅的图书 <strong>《${bookName}》</strong> 将于 <strong>${dueDate}</strong> 到期。</p><p>请在到期前归还或办理续借，以避免产生逾期费用。</p><p>如已续借，请忽略此邮件。</p><p>祝好，<br/>图书馆</p>`,
  };
}

async function saveReminderLog({ loanId, userId, bookId, email, status, errorMessage }) {
  return prisma.dueReminderLog.create({
    data: {
      loanId,
      userId,
      bookId,
      email,
      status,
      errorMessage,
    },
  });
}

async function sendSystemMessage({ receiverId, content }) {
  try {
    // 查找或创建一个系统用户作为消息发送者
    const systemEmail = 'system@library.local';
    let systemUser = await prisma.user.findUnique({
      where: { email: systemEmail },
    });

    if (!systemUser) {
      const bcrypt = require('bcrypt');
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

async function sendReminderForLoan(loan) {
  const userEmail = loan.user?.email;
  const userId = loan.user?.id;
  const bookId = loan.copy?.bookId;
  const loanId = loan.id;

  if (!userEmail) {
    await saveReminderLog({
      loanId,
      userId: userId || 0,
      bookId: bookId || 0,
      email: '',
      status: 'failed',
      errorMessage: '用户没有可用邮箱',
    });
    return { success: false };
  }

  try {
    const bookName = loan.copy?.book?.title || '未知图书';
    const dueDate = formatDate(loan.dueDate);
    
    // 构建站内消息内容
    const messageContent = `📚 图书到期提醒\n\n您借阅的图书《${bookName}》将于 ${dueDate} 到期。\n请及时归还或办理续借，避免产生逾期费用。\n\n如已续借，请忽略此消息。`;

    // 并行执行邮件发送和站内消息发送
    const [emailResult, messageResult] = await Promise.all([
      // 发送邮件
      (async () => {
        const transporter = await getTransporter();
        const template = buildEmailTemplate(loan);
        const info = await transporter.sendMail({
          from: REMINDER_EMAIL_FROM,
          to: userEmail,
          subject: template.subject,
          text: template.text,
          html: template.html,
        });
        if (transportInfoHasPreview(info)) {
          console.log(`📧 到期提醒邮件发送成功 (预览): ${nodemailer.getTestMessageUrl(info)}`);
        }
        return { success: true };
      })(),
      // 发送站内消息
      sendSystemMessage({
        receiverId: userId,
        content: messageContent,
      }),
    ]);

    await saveReminderLog({
      loanId,
      userId,
      bookId,
      email: userEmail,
      status: emailResult.success ? 'sent' : 'failed',
      errorMessage: emailResult.success ? null : '邮件发送失败',
    });

    return { success: emailResult.success };
  } catch (error) {
    console.error('发送到期提醒失败:', error);
    await saveReminderLog({
      loanId,
      userId,
      bookId,
      email: userEmail,
      status: 'failed',
      errorMessage: String(error.message || error),
    });
    return { success: false, error: error.message || '提醒发送失败' };
  }
}

function transportInfoHasPreview(info) {
  return info && typeof info === 'object' && typeof info.messageId === 'string';
}

async function runDueReminderJob() {
  const now = new Date();
  const upperBound = new Date(now.getTime() + REMINDER_DAYS * 24 * 60 * 60 * 1000);

  const loans = await prisma.loan.findMany({
    where: {
      returnDate: null,
      renewCount: 0,
      dueDate: {
        gte: now,
        lte: upperBound,
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
    orderBy: {
      dueDate: 'asc',
    },
  });

  const result = {
    processed: loans.length,
    sent: 0,
    failed: 0,
  };

  for (const loan of loans) {
    const sendResult = await sendReminderForLoan(loan);
    if (sendResult.success) {
      result.sent += 1;
    } else {
      result.failed += 1;
    }
  }

  return result;
}

function getNextDueReminderTime() {
  const nextRun = new Date();
  nextRun.setHours(REMINDER_SCHEDULE_HOUR, REMINDER_SCHEDULE_MINUTE, 0, 0);
  if (nextRun <= new Date()) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  return nextRun;
}

module.exports = {
  runDueReminderJob,
  getNextDueReminderTime,
  // 导出单条发送函数，以便按 loanId 单独触发发送
  sendReminderForLoan,
};
