/*
  Warnings:

  - You are about to drop the column `userId` on the `Registration` table. All the data in the column will be lost.
  - Added the required column `customerId` to the `Registration` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Registration" DROP CONSTRAINT "Registration_userId_fkey";

-- DropIndex
DROP INDEX "Registration_userId_idx";

-- DropIndex
DROP INDEX "Registration_userId_workshopId_key";

-- AlterTable
ALTER TABLE "Registration" DROP COLUMN "userId",
ADD COLUMN     "customerId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_tenantId_key" ON "Customer"("phone", "tenantId");

-- CreateIndex
CREATE INDEX "Registration_customerId_idx" ON "Registration"("customerId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
