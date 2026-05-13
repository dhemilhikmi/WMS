import prisma from '../lib/prisma';

const ONE_HOUR_MS = 60 * 60 * 1000;

export async function downgradeExpiredPlans() {
  const now = new Date();

  const result = await prisma.tenant.updateMany({
    where: {
      plan: 'pro',
      planExpiry: {
        not: null,
        lt: now,
      },
      NOT: {
        partnerType: 'ppf_partner',
      },
    },
    data: {
      plan: 'free',
    },
  });

  if (result.count > 0) {
    console.log(`[plan-expiry] Downgraded ${result.count} expired Pro tenant(s) to Free`);
  }

  return result.count;
}

export function startPlanExpiryJob() {
  downgradeExpiredPlans().catch((err) => {
    console.error('[plan-expiry] Initial downgrade check failed:', err);
  });

  return setInterval(() => {
    downgradeExpiredPlans().catch((err) => {
      console.error('[plan-expiry] Scheduled downgrade check failed:', err);
    });
  }, ONE_HOUR_MS);
}
