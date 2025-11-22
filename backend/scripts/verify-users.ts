import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load .env so DATABASE_URL beolvasódik
dotenv.config();

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('🔄 Minden felhasználó verified visszaállítása (true)...');
    const result = await prisma.user.updateMany({
      data: { verified: true },
    });
    console.log(`✅ Kész. Frissített sorok száma: ${result.count}`);
  } catch (err) {
    console.error('❌ Hiba történt:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
