const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const email = process.env.RESET_USER_EMAIL;
const dryRun = process.env.DRY_RUN === 'true';

async function countAll(tenantId) {
  const [
    warranties,
    registrations,
    serviceMaterials,
    inventoryLogs,
    inventoryBatches,
    purchaseOrders,
    expenses,
    suppliers,
    inventory,
    customers,
    teknisi,
  ] = await Promise.all([
    prisma.warranty.count({ where: { tenantId } }),
    prisma.registration.count({ where: { tenantId } }),
    prisma.serviceMaterial.count({ where: { tenantId } }),
    prisma.inventoryLog.count({ where: { tenantId } }),
    prisma.inventoryBatch.count({ where: { tenantId } }),
    prisma.purchaseOrder.count({ where: { tenantId } }),
    prisma.expense.count({ where: { tenantId } }),
    prisma.supplier.count({ where: { tenantId } }),
    prisma.inventory.count({ where: { tenantId } }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.teknisi.count({ where: { tenantId } }),
  ]);

  return {
    warranties,
    registrations,
    serviceMaterials,
    inventoryLogs,
    inventoryBatches,
    purchaseOrders,
    expenses,
    suppliers,
    inventory,
    customers,
    teknisi,
  };
}

async function main() {
  if (!email) throw new Error('RESET_USER_EMAIL is required');

  const users = await prisma.user.findMany({
    where: { email },
    include: { tenant: true },
    orderBy: { createdAt: 'asc' },
  });

  if (users.length === 0) throw new Error(`User not found: ${email}`);

  const targets = users.filter((user) => user.tenant?.slug !== 'platform');
  if (targets.length === 0) throw new Error(`No tenant user found for: ${email}`);

  const result = [];

  for (const user of targets) {
    const tenantId = user.tenantId;
    const before = await countAll(tenantId);

    if (!dryRun) {
      await prisma.$transaction([
        prisma.warranty.deleteMany({ where: { tenantId } }),
        prisma.registration.deleteMany({ where: { tenantId } }),
        prisma.serviceMaterial.deleteMany({ where: { tenantId } }),
        prisma.inventoryLog.deleteMany({ where: { tenantId } }),
        prisma.inventoryBatch.deleteMany({ where: { tenantId } }),
        prisma.purchaseOrder.deleteMany({ where: { tenantId } }),
        prisma.expense.deleteMany({ where: { tenantId } }),
        prisma.supplier.deleteMany({ where: { tenantId } }),
        prisma.inventory.deleteMany({ where: { tenantId } }),
        prisma.customer.deleteMany({ where: { tenantId } }),
        prisma.teknisi.deleteMany({ where: { tenantId } }),
      ]);
    }

    result.push({
      email: user.email,
      userId: user.id,
      tenantId,
      tenantName: user.tenant.name,
      tenantSlug: user.tenant.slug,
      dryRun,
      before,
      after: dryRun ? null : await countAll(tenantId),
      preserved: ['tenant', 'users', 'features', 'subscription', 'workshops/services', 'tenant settings'],
    });
  }

  console.log(JSON.stringify({ success: true, targets: result }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
