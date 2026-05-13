-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "partnerType" TEXT,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "planExpiry" TIMESTAMP(3);
