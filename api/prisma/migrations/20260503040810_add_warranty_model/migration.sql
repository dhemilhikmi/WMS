-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "registrationId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_code_key" ON "Warranty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_registrationId_key" ON "Warranty"("registrationId");

-- CreateIndex
CREATE INDEX "Warranty_tenantId_idx" ON "Warranty"("tenantId");

-- CreateIndex
CREATE INDEX "Warranty_customerId_idx" ON "Warranty"("customerId");

-- CreateIndex
CREATE INDEX "Warranty_status_idx" ON "Warranty"("status");

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
