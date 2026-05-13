import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAllExistingTenantsToPro() {
  const result = await prisma.tenant.updateMany({
    data: {
      plan: 'pro',
      planExpiry: null,
      partnerType: null,
    },
  });

  console.log(`Updated ${result.count} existing tenants to pro.`);
}

updateAllExistingTenantsToPro()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
