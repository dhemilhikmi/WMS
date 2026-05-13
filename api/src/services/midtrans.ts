import midtransClient from 'midtrans-client';
import prisma from '../lib/prisma';


const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true' || false,
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-test-key',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-test-key',
});

const core = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true' || false,
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-test-key',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-test-key',
});

export async function createPaymentOrder(
  tenantId: string,
  planId: string,
  tenantName: string,
  tenantEmail: string,
  adminName: string,
  adminEmail: string
): Promise<{ orderId: string; snapToken: string }> {
  void adminName;
  void adminEmail;

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  const orderId = `ORDER-${Date.now()}-${tenantId.substring(0, 8)}`;
  const amount = Math.round(Number(plan.price));

  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    customer_details: {
      first_name: tenantName,
      email: tenantEmail,
      phone: '',
    },
    item_details: [
      {
        id: planId,
        price: amount,
        quantity: 1,
        name: `${plan.name} Plan - Monthly Subscription`,
      },
    ],
    custom_field1: tenantId,
    custom_field2: planId,
  };

  try {
    const response = await snap.createTransaction(parameter);
    const snapToken = response.token;

    // Save the order ID to subscription (with status pending)
    await prisma.tenantSubscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId,
        status: 'pending',
        paymentOrderId: orderId,
        paymentStatus: 'unpaid',
      },
      update: {
        planId,
        status: 'pending',
        paymentOrderId: orderId,
        paymentStatus: 'unpaid',
      },
    });

    return { orderId, snapToken };
  } catch (err: any) {
    console.error('Midtrans error:', err);
    throw new Error(`Failed to create payment order: ${err.message}`);
  }
}

export async function verifyPaymentStatus(orderId: string): Promise<any> {
  try {
    const response = await core.transaction.status(orderId);
    return response;
  } catch (err: any) {
    console.error('Verification error:', err);
    throw new Error(`Failed to verify payment: ${err.message}`);
  }
}

export async function handlePaymentNotification(notification: any): Promise<void> {
  try {
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const paymentType = notification.payment_type;
    const transactionId = notification.transaction_id;

    // Find subscription by order ID
    const subscription = await prisma.tenantSubscription.findFirst({
      where: { paymentOrderId: orderId },
    });

    if (!subscription) {
      console.warn(`Order ID ${orderId} not found`);
      return;
    }

    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      // Calculate subscription period (30 days)
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      await prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          paymentStatus: 'paid',
          paymentMethod: paymentType,
          transactionId,
          paidAt: new Date(),
          startDate,
          endDate,
        },
      });
    } else if (transactionStatus === 'denied' || transactionStatus === 'cancel' || transactionStatus === 'expire') {
      await prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: {
          status: 'cancelled',
          paymentStatus: transactionStatus,
          paymentMethod: paymentType,
          transactionId,
        },
      });
    } else if (transactionStatus === 'pending') {
      await prisma.tenantSubscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: 'pending',
          paymentMethod: paymentType,
          transactionId,
        },
      });
    }

    console.log(`Payment notification processed for order ${orderId}: ${transactionStatus}`);
  } catch (err: any) {
    console.error('Failed to handle payment notification:', err);
    throw err;
  }
}

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signature: string
): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-test-key';
  const data = orderId + statusCode + grossAmount + serverKey;
  const crypto = require('crypto');
  const calculatedSignature = crypto.createHash('sha512').update(data).digest('hex');
  return calculatedSignature === signature;
}
