const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const email = process.env.RESET_USER_EMAIL;
const password = process.env.RESET_USER_PASSWORD;

async function main() {
  if (!email) throw new Error('RESET_USER_EMAIL is required');
  if (!password || password.length < 8) throw new Error('RESET_USER_PASSWORD minimal 8 characters is required');

  const users = await prisma.user.findMany({
    where: { email },
    include: { tenant: true },
  });

  if (users.length === 0) throw new Error(`User not found: ${email}`);

  const hashed = await bcrypt.hash(password, 12);
  const result = [];

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        emailVerified: true,
        resetPasswordToken: null,
        resetPasswordTokenExpiry: null,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: { isActive: true },
    });

    result.push({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenant: user.tenant.name,
      tenantSlug: user.tenant.slug,
    });
  }

  console.log(JSON.stringify({ success: true, updated: result }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
