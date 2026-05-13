const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const email = process.env.INSPECT_USER_EMAIL;

async function main() {
  if (!email) throw new Error('INSPECT_USER_EMAIL is required');

  const users = await prisma.user.findMany({
    where: { email },
    include: {
      tenant: {
        include: {
          subscription: { include: { plan: true } },
          _count: {
            select: {
              customers: true,
              registrations: true,
              inventory: true,
              suppliers: true,
              expenses: true,
              workshops: true,
              users: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(JSON.stringify({
    email,
    count: users.length,
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      hasPasswordHash: typeof user.password === 'string' && user.password.length > 20,
      resetTokenActive: !!user.resetPasswordTokenExpiry && user.resetPasswordTokenExpiry > new Date(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      tenant: user.tenant && {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        email: user.tenant.email,
        isActive: user.tenant.isActive,
        plan: user.tenant.plan,
        planExpiry: user.tenant.planExpiry,
        partnerType: user.tenant.partnerType,
        subscription: user.tenant.subscription && {
          status: user.tenant.subscription.status,
          plan: user.tenant.subscription.plan && user.tenant.subscription.plan.name,
        },
        counts: user.tenant._count,
      },
    })),
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
