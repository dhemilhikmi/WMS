-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentOrderId" TEXT,
ADD COLUMN     "paymentStatus" TEXT,
ADD COLUMN     "transactionId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "TenantSubscription_paymentOrderId_idx" ON "TenantSubscription"("paymentOrderId");
