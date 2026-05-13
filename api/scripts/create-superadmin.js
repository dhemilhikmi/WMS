const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME || 'Super Admin';

  if (!email || !password || password.length < 12) {
    throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD (min 12 chars) are required');
  }

  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'platform' },
    create: {
      name: 'Platform',
      slug: 'platform',
      email: 'platform@workshopmu.com',
      isActive: true,
    },
    update: { isActive: true },
  });

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email,
        tenantId: platformTenant.id,
      },
    },
    create: {
      email,
      name,
      password: hashedPassword,
      role: 'superadmin',
      tenantId: platformTenant.id,
      emailVerified: true,
    },
    update: {
      name,
      password: hashedPassword,
      role: 'superadmin',
      emailVerified: true,
    },
  });

  console.log(JSON.stringify({
    success: true,
    email: user.email,
    role: user.role,
    tenant: platformTenant.slug,
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
