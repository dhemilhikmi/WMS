const zlib = require('zlib');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function payload() {
  const encoded = process.env.MIGRATION_DATA_GZ_B64;
  if (!encoded) throw new Error('MIGRATION_DATA_GZ_B64 is required');
  return JSON.parse(zlib.gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
}

function strip(row, extra = []) {
  const copy = { ...row };
  for (const key of extra) delete copy[key];
  return copy;
}

async function upsertById(model, row) {
  return prisma[model].upsert({
    where: { id: row.id },
    update: strip(row, ['id', 'createdAt']),
    create: row,
  });
}

async function upsertMappedTenant(row, tenantMap) {
  const existing = await prisma.tenant.findFirst({
    where: { OR: [{ id: row.id }, { slug: row.slug }, { email: row.email }] },
  });
  if (existing) {
    const updated = await prisma.tenant.update({
      where: { id: existing.id },
      data: strip(row, ['id', 'createdAt', 'slug', 'email']),
    });
    tenantMap.set(row.id, updated.id);
    return updated;
  }
  const created = await prisma.tenant.create({ data: row });
  tenantMap.set(row.id, created.id);
  return created;
}

async function main() {
  const data = payload();
  const tenantMap = new Map();
  const featureMap = new Map();
  const planMap = new Map();
  const customerMap = new Map();
  const workshopMap = new Map();
  const inventoryMap = new Map();
  const registrationMap = new Map();

  const counts = {};
  const count = (key) => { counts[key] = (counts[key] || 0) + 1; };

  for (const row of data.shared.feature || []) {
    const saved = await prisma.feature.upsert({
      where: { name: row.name },
      update: strip(row, ['id', 'createdAt', 'name']),
      create: row,
    });
    featureMap.set(row.id, saved.id);
    count('feature');
  }

  for (const row of data.shared.subscriptionPlan || []) {
    const saved = await prisma.subscriptionPlan.upsert({
      where: { name: row.name },
      update: strip(row, ['id', 'createdAt', 'name']),
      create: row,
    });
    planMap.set(row.id, saved.id);
    count('subscriptionPlan');
  }

  for (const row of data.tenants || []) {
    await upsertMappedTenant(row, tenantMap);
    count('tenant');
  }

  for (const row of data.tenantData.user || []) {
    const tenantId = tenantMap.get(row.tenantId);
    if (!tenantId) continue;
    const existing = await prisma.user.findFirst({ where: { OR: [{ id: row.id }, { email: row.email, tenantId }] } });
    const body = { ...row, tenantId };
    if (existing) await prisma.user.update({ where: { id: existing.id }, data: strip(body, ['id', 'createdAt', 'email', 'tenantId']) });
    else await prisma.user.create({ data: body });
    count('user');
  }

  for (const row of data.tenantData.workshop || []) {
    const tenantId = tenantMap.get(row.tenantId);
    if (!tenantId) continue;
    const parentId = row.parentId ? workshopMap.get(row.parentId) || row.parentId : null;
    const saved = await upsertById('workshop', { ...row, tenantId, parentId });
    workshopMap.set(row.id, saved.id);
    count('workshop');
  }

  for (const row of data.tenantData.customer || []) {
    const tenantId = tenantMap.get(row.tenantId);
    if (!tenantId) continue;
    const body = { ...row, tenantId };
    const existing = await prisma.customer.findFirst({ where: { OR: [{ id: row.id }, { phone: row.phone, tenantId }] } });
    const saved = existing
      ? await prisma.customer.update({ where: { id: existing.id }, data: strip(body, ['id', 'createdAt', 'phone', 'tenantId']) })
      : await prisma.customer.create({ data: body });
    customerMap.set(row.id, saved.id);
    count('customer');
  }

  for (const row of data.tenantData.inventory || []) {
    const tenantId = tenantMap.get(row.tenantId);
    if (!tenantId) continue;
    const saved = await upsertById('inventory', { ...row, tenantId });
    inventoryMap.set(row.id, saved.id);
    count('inventory');
  }

  for (const model of ['supplier', 'purchaseOrder', 'expense', 'teknisi']) {
    for (const row of data.tenantData[model] || []) {
      const tenantId = tenantMap.get(row.tenantId);
      if (!tenantId) continue;
      await upsertById(model, { ...row, tenantId });
      count(model);
    }
  }

  for (const row of data.tenantData.tenantSetting || []) {
    const tenantId = tenantMap.get(row.tenantId);
    if (!tenantId) continue;
    const body = { ...row, tenantId };
    await prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key: row.key } },
      update: strip(body, ['id', 'createdAt', 'tenantId', 'key']),
      create: body,
    });
    count('tenantSetting');
  }

  for (const row of data.tenantData.tenantFeature || []) {
    const tenantId = tenantMap.get(row.tenantId);
    const featureId = featureMap.get(row.featureId);
    if (!tenantId || !featureId) continue;
    const body = { ...row, tenantId, featureId };
    await prisma.tenantFeature.upsert({
      where: { tenantId_featureId: { tenantId, featureId } },
      update: strip(body, ['id', 'createdAt', 'tenantId', 'featureId']),
      create: body,
    });
    count('tenantFeature');
  }

  for (const row of data.tenantData.tenantSubscription || []) {
    const tenantId = tenantMap.get(row.tenantId);
    if (!tenantId) continue;
    const body = { ...row, tenantId, planId: row.planId ? planMap.get(row.planId) || row.planId : null };
    await prisma.tenantSubscription.upsert({
      where: { tenantId },
      update: strip(body, ['id', 'createdAt', 'tenantId']),
      create: body,
    });
    count('tenantSubscription');
  }

  for (const row of data.tenantData.registration || []) {
    const tenantId = tenantMap.get(row.tenantId);
    const customerId = customerMap.get(row.customerId);
    const workshopId = workshopMap.get(row.workshopId);
    if (!tenantId || !customerId || !workshopId) continue;
    const saved = await upsertById('registration', { ...row, tenantId, customerId, workshopId });
    registrationMap.set(row.id, saved.id);
    count('registration');
  }

  for (const row of data.tenantData.inventoryBatch || []) {
    const tenantId = tenantMap.get(row.tenantId);
    const inventoryId = inventoryMap.get(row.inventoryId);
    if (!tenantId || !inventoryId) continue;
    await upsertById('inventoryBatch', { ...row, tenantId, inventoryId });
    count('inventoryBatch');
  }

  for (const row of data.tenantData.serviceMaterial || []) {
    const tenantId = tenantMap.get(row.tenantId);
    const workshopId = workshopMap.get(row.workshopId);
    const inventoryId = inventoryMap.get(row.inventoryId);
    if (!tenantId || !workshopId || !inventoryId) continue;
    const body = { ...row, tenantId, workshopId, inventoryId };
    await prisma.serviceMaterial.upsert({
      where: { workshopId_inventoryId: { workshopId, inventoryId } },
      update: strip(body, ['id', 'createdAt', 'tenantId', 'workshopId', 'inventoryId']),
      create: body,
    });
    count('serviceMaterial');
  }

  for (const row of data.tenantData.warranty || []) {
    const tenantId = tenantMap.get(row.tenantId);
    const customerId = customerMap.get(row.customerId);
    const workshopId = workshopMap.get(row.workshopId);
    const registrationId = registrationMap.get(row.registrationId);
    if (!tenantId || !customerId || !workshopId || !registrationId) continue;
    const existing = await prisma.warranty.findFirst({ where: { OR: [{ id: row.id }, { code: row.code }, { registrationId }] } });
    const body = { ...row, tenantId, customerId, workshopId, registrationId };
    if (existing) await prisma.warranty.update({ where: { id: existing.id }, data: strip(body, ['id', 'createdAt', 'code', 'registrationId']) });
    else await prisma.warranty.create({ data: body });
    count('warranty');
  }

  for (const row of data.tenantData.inventoryLog || []) {
    const tenantId = tenantMap.get(row.tenantId);
    const inventoryId = inventoryMap.get(row.inventoryId);
    if (!tenantId || !inventoryId) continue;
    await upsertById('inventoryLog', { ...row, tenantId, inventoryId });
    count('inventoryLog');
  }

  console.log(JSON.stringify({ success: true, exportedAt: data.exportedAt, counts }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
