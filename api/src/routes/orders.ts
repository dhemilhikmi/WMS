import { Router, Request, Response } from 'express';
import { createPaymentOrder, handlePaymentNotification, verifyMidtransSignature } from '../services/midtrans';
import { PAYMENT_ENABLED } from '../config';

const router = Router();

router.use((_req: Request, res: Response, next): void => {
  if (!PAYMENT_ENABLED) {
    res.status(503).json({
      success: false,
      message: 'Payment is temporarily disabled',
      code: 'PAYMENT_DISABLED',
    });
    return;
  }
  next();
});

interface CreateOrderBody {
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  planId: string;
  adminName: string;
  adminEmail: string;
}

// POST /api/orders/create - Create payment order and get Snap token
router.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, tenantName, tenantEmail, planId, adminName, adminEmail } = req.body as CreateOrderBody;

    if (!tenantId || !tenantName || !tenantEmail || !planId || !adminName || !adminEmail) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
      return;
    }

    const result = await createPaymentOrder(tenantId, planId, tenantName, tenantEmail, adminName, adminEmail);

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('Create order error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to create payment order',
    });
  }
});

// POST /api/orders/webhook - Midtrans webhook handler
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const notification = req.body;

    // Verify signature (optional but recommended)
    const signature = notification.signature_key;
    const orderId = notification.order_id;
    const statusCode = notification.status_code;
    const grossAmount = notification.gross_amount;

    if (!signature || !verifyMidtransSignature(orderId, statusCode, grossAmount, signature)) {
      console.warn('Invalid signature for order:', orderId);
      res.status(403).json({
        success: false,
        message: 'Invalid payment notification signature',
      });
      return;
    }

    // Handle the payment notification
    await handlePaymentNotification(notification);

    // Always return 200 to acknowledge receipt
    res.status(200).json({
      success: true,
      message: 'Notification processed',
    });
  } catch (err: any) {
    console.error('Webhook error:', err);
    // Still return 200 to prevent Midtrans from retrying
    res.status(200).json({
      success: false,
      message: 'Error processing notification',
    });
  }
});

export default router;
