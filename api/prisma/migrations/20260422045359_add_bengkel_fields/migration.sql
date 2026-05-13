-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "price" DECIMAL(65,30) NOT NULL DEFAULT 0;
