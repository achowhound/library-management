require('dotenv').config()
const prisma = require('../lib/prisma')
const { sendReminderForLoan } = require('../services/dueReminder')

async function run() {
  try {
    // 找到一个符合提醒条件的借阅记录（未归还、未续借、到期在未来 N 天内）
    const now = new Date()
    const upper = new Date(now.getTime() + Number(process.env.DUE_REMINDER_DAYS || '3') * 24 * 60 * 60 * 1000)
    const loan = await prisma.loan.findFirst({
      where: { returnDate: null, renewCount: 0, dueDate: { gte: now, lte: upper } },
      include: { user: true, copy: { include: { book: true } } },
    })

    if (!loan) {
      console.log('No pending loan found to test.')
      process.exit(0)
    }

    console.log('Testing send for loan id:', loan.id)
    const res = await sendReminderForLoan(loan)
    console.log('sendReminderForLoan result:', res)
    process.exit(0)
  } catch (err) {
    console.error('Script error:', err)
    process.exit(1)
  }
}

run()
