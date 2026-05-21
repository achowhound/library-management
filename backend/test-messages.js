const prisma = require('./src/lib/prisma');

async function testMessages() {
  console.log('=== 测试消息系统 ===\n');

  // 1. 查询所有 LIBRARIAN 角色的用户
  const librarianUsers = await prisma.user.findMany({
    where: { role: 'LIBRARIAN' },
    select: { id: true, name: true, email: true, role: true }
  });

  console.log('📋 图书馆管理员用户:');
  if (librarianUsers.length === 0) {
    console.log('  ⚠️  没有找到任何管理员用户！');
  } else {
    console.table(librarianUsers);
  }

  // 2. 查询所有读者用户
  const readerUsers = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, name: true, email: true, role: true },
    take: 5
  });

  console.log('\n📚 部分读者用户:');
  if (readerUsers.length === 0) {
    console.log('  ⚠️  没有找到任何读者用户！');
  } else {
    console.table(readerUsers);
  }

  // 3. 查询所有消息
  const allMessages = await prisma.message.findMany({
    include: {
      sender: { select: { id: true, name: true, role: true } },
      receiver: { select: { id: true, name: true, role: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  console.log('\n💬 最近的消息:');
  if (allMessages.length === 0) {
    console.log('  ⚠️  数据库中没有任何消息！');
  } else {
    allMessages.forEach(msg => {
      console.log(`ID: ${msg.id}`);
      console.log(`  发送者: ${msg.sender.name} (ID: ${msg.senderId}, 角色: ${msg.sender.role})`);
      console.log(`  接收者: ${msg.receiver.name} (ID: ${msg.receiverId}, 角色: ${msg.receiver.role})`);
      console.log(`  内容: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`);
      console.log(`  已读: ${msg.isRead}`);
      console.log(`  时间: ${msg.createdAt}`);
      console.log('---');
    });
  }

  // 4. 如果有管理员，检查每个管理员的会话
  for (const librarian of librarianUsers) {
    console.log(`\n🔍 检查管理员 "${librarian.name}" (ID: ${librarian.id}) 的会话:`);
    
    const conversations = await prisma.message.groupBy({
      by: ['senderId'],
      where: {
        OR: [
          { senderId: librarian.id },
          { receiverId: librarian.id }
        ]
      },
      _count: { id: true }
    });

    if (conversations.length === 0) {
      console.log('  ⚠️  该管理员没有任何消息会话');
    } else {
      console.table(conversations);
    }

    // 获取未读消息数
    const unreadCount = await prisma.message.count({
      where: {
        receiverId: librarian.id,
        isRead: false
      }
    });
    console.log(`  📨 未读消息数: ${unreadCount}`);
  }

  // 5. 如果有读者，检查读者的会话
  if (readerUsers.length > 0) {
    const firstReader = readerUsers[0];
    console.log(`\n🔍 检查读者 "${firstReader.name}" (ID: ${firstReader.id}) 的会话:`);
    
    const conversations = await prisma.message.groupBy({
      by: ['receiverId'],
      where: {
        OR: [
          { senderId: firstReader.id },
          { receiverId: firstReader.id }
        ]
      },
      _count: { id: true }
    });

    if (conversations.length === 0) {
      console.log('  ⚠️  该读者没有任何消息会话');
    } else {
      console.table(conversations);
    }
  }

  await prisma.$disconnect();
  console.log('\n✅ 测试完成！');
}

testMessages().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
