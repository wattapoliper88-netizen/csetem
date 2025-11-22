import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('test123', 10);
  
  const user = await prisma.user.create({
    data: {
      email: 'tiltott@test.com',
      username: 'TiltottUser',
      passwordHash,
      verified: false,  // TILTVA
      isAdmin: false,
    },
  });

  console.log('✅ Tiltott felhasználó létrehozva:');
  console.log('  Email:', user.email);
  console.log('  Username:', user.username);
  console.log('  Password: test123');
  console.log('  Verified:', user.verified);
  
  // Create conversation with admin
  const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
  if (admin) {
    await prisma.conversation.create({
      data: {
        userId: user.id,
        adminId: admin.id,
      },
    });
    console.log('✅ Conversation létrehozva az adminnal');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
