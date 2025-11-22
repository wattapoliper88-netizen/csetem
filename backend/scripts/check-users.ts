import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      verified: true,
      isAdmin: true,
    },
  });

  console.log('📊 Felhasználók állapota:');
  console.log('─'.repeat(60));
  users.forEach(user => {
    const verifiedLabel = user.verified ? '✅ Verified' : '🚫 Tiltva';
    const adminLabel = user.isAdmin ? '👑 Admin' : '👤 User';
    console.log(`${user.username} (${user.email})`);
    console.log(`  ${verifiedLabel} | ${adminLabel}`);
    console.log('─'.repeat(60));
  });

  await prisma.$disconnect();
}

main();
