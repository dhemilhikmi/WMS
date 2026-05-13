import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('Starting seed...');

  // Define the 5 canonical features
  const featureDefinitions = [
    {
      name: 'workshops',
      displayName: 'Workshop Management',
      description: 'Create, edit, and manage workshops',
      isDefault: true,
    },
    {
      name: 'registrations',
      displayName: 'Registration Management',
      description: 'Manage workshop registrations and attendance',
      isDefault: true,
    },
    {
      name: 'reports',
      displayName: 'Reports & Analytics',
      description: 'View detailed analytics and reports',
      isDefault: false,
    },
    {
      name: 'certificates',
      displayName: 'Certificate Generation',
      description: 'Generate completion certificates',
      isDefault: false,
    },
    {
      name: 'payments',
      displayName: 'Payment Integration',
      description: 'Accept payments for workshops',
      isDefault: false,
    },
  ];

  // Upsert features
  console.log('Upserting features...');
  const features = await Promise.all(
    featureDefinitions.map((def) =>
      prisma.feature.upsert({
        where: { name: def.name },
        update: {
          displayName: def.displayName,
          description: def.description,
          isDefault: def.isDefault,
        },
        create: def,
      })
    )
  );

  console.log(`Created/updated ${features.length} features`);

  // Get all default features
  const defaultFeatures = features.filter((f) => f.isDefault);

  // Get all existing tenants
  console.log('Backfilling existing tenants with default features...');
  const tenants = await prisma.tenant.findMany();

  let tenantFeaturesCreated = 0;

  for (const tenant of tenants) {
    for (const feature of defaultFeatures) {
      const result = await prisma.tenantFeature.upsert({
        where: {
          tenantId_featureId: {
            tenantId: tenant.id,
            featureId: feature.id,
          },
        },
        create: {
          tenantId: tenant.id,
          featureId: feature.id,
          enabled: true,
        },
        update: {},
      });

      if (result) tenantFeaturesCreated++;
    }
  }

  console.log(`Created/updated ${tenantFeaturesCreated} tenant-feature links`);

  // Create or get platform tenant
  console.log('Setting up platform tenant and superadmin...');
  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'platform' },
    create: {
      name: 'Platform',
      slug: 'platform',
      email: 'platform@system.local',
      isActive: true,
    },
    update: { isActive: true },
  });

  // Create superadmin user in platform tenant
  const superadminUser = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'superadmin@platform.local',
        tenantId: platformTenant.id,
      },
    },
    create: {
      email: 'superadmin@platform.local',
      name: 'Super Admin',
      password: await bcrypt.hash('superadmin123', BCRYPT_ROUNDS),
      role: 'superadmin',
      tenantId: platformTenant.id,
      emailVerified: true,
    },
    update: {
      emailVerified: true,
    },
  });

  console.log(`Superadmin user created: ${superadminUser.email}`);

  // Define default subscription plans
  const planDefinitions = [
    {
      name: 'Starter',
      description: 'Free forever: hingga 50 transaksi/bulan, 2 teknisi, customer & inventaris unlimited, 1 template kartu garansi, laporan pendapatan dasar, akses mobile web.',
      price: new Prisma.Decimal(0),
      maxUsers: 2,
      maxServices: 50,
    },
    {
      name: 'Pro',
      description: 'Annual only: early adopter Rp 2.499.000/tahun, transaksi & teknisi unlimited, BOM HPP, laporan keuangan lengkap, analitik bengkel, garansi premium, priority support.',
      price: new Prisma.Decimal(2499000),
      maxUsers: 999,
      maxServices: 999,
    },
  ];

  // Upsert subscription plans
  console.log('Creating subscription plans...');
  const plans = await Promise.all(
    planDefinitions.map((def) =>
      prisma.subscriptionPlan.upsert({
        where: { name: def.name },
        update: {
          description: def.description,
          price: def.price,
          maxUsers: def.maxUsers,
          maxServices: def.maxServices,
        },
        create: def,
      })
    )
  );

  console.log(`Created/updated ${plans.length} subscription plans`);

  // Auto-assign trial subscriptions to existing tenants (except platform)
  console.log('Assigning trial subscriptions to existing tenants...');
  const nonPlatformTenants = tenants.filter((t) => t.id !== platformTenant.id);

  for (const tenant of nonPlatformTenants) {
    await prisma.tenantSubscription.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        status: 'trial',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      update: {},
    });
  }

  console.log(`Assigned trial subscriptions to ${nonPlatformTenants.length} tenants`);

  // Create test tenant for development
  console.log('Creating test tenant for development...');
  const testTenant = await prisma.tenant.upsert({
    where: { slug: 'test-academy' },
    create: {
      name: 'Test Academy',
      slug: 'test-academy',
      email: 'test@academy.com',
      isActive: true,
    },
    update: { isActive: true },
  });

  // Create test admin user
  const testAdminUser = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'admin@test.com',
        tenantId: testTenant.id,
      },
    },
    create: {
      email: 'admin@test.com',
      name: 'Test Admin',
      password: await bcrypt.hash('password123', BCRYPT_ROUNDS),
      role: 'admin',
      tenantId: testTenant.id,
      emailVerified: true,
    },
    update: { emailVerified: true },
  });

  // Create test subscription
  const starterPlan = plans.find((p) => p.name === 'Starter');
  if (starterPlan) {
    await prisma.tenantSubscription.upsert({
      where: { tenantId: testTenant.id },
      create: {
        tenantId: testTenant.id,
        planId: starterPlan.id,
        status: 'active',
        paymentStatus: 'paid',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: { status: 'active' },
    });
  }

  console.log(`Test admin user created: ${testAdminUser.email}`);

  // Create default services for all non-platform tenants
  console.log('Creating default services for tenants...');
  const defaultServiceDefinitions = [
    {
      title: 'Detailing',
      description: 'Professional car detailing service',
      price: new Prisma.Decimal(0),
      type: 'main_service' as const,
    },
    {
      title: 'Paint Protection Film (PPF)',
      description: 'Paint protection film application service',
      price: new Prisma.Decimal(0),
      type: 'main_service' as const,
    },
  ];

  for (const tenant of nonPlatformTenants) {
    for (const serviceDef of defaultServiceDefinitions) {
      await prisma.workshop.upsert({
        where: {
          id: `${tenant.id}-${serviceDef.title.toLowerCase().replace(/\s+/g, '-')}`,
        },
        create: {
          id: `${tenant.id}-${serviceDef.title.toLowerCase().replace(/\s+/g, '-')}`,
          title: serviceDef.title,
          description: serviceDef.description,
          price: serviceDef.price,
          type: serviceDef.type,
          tenantId: tenant.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          maxCapacity: 10,
          status: 'published',
        },
        update: {},
      });
    }
  }

  console.log('Default services created for tenants');
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
