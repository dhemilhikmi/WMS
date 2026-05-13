-- CreateTable
CREATE TABLE "ServiceMaterial" (
    "id" TEXT NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workshopId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ServiceMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceMaterial_tenantId_idx" ON "ServiceMaterial"("tenantId");

-- CreateIndex
CREATE INDEX "ServiceMaterial_workshopId_idx" ON "ServiceMaterial"("workshopId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceMaterial_workshopId_inventoryId_key" ON "ServiceMaterial"("workshopId", "inventoryId");

-- AddForeignKey
ALTER TABLE "ServiceMaterial" ADD CONSTRAINT "ServiceMaterial_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMaterial" ADD CONSTRAINT "ServiceMaterial_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMaterial" ADD CONSTRAINT "ServiceMaterial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
