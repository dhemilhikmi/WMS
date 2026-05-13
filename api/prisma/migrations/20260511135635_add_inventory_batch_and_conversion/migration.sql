-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "isiPerUnit" DOUBLE PRECISION,
ADD COLUMN     "satuanPakai" TEXT;

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL,
    "qtyAwal" DOUBLE PRECISION NOT NULL,
    "qtySisa" DOUBLE PRECISION NOT NULL,
    "hargaPerUnit" DECIMAL(65,30) NOT NULL,
    "noPO" TEXT,
    "pemasok" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isStokAwal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inventoryId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryBatch_inventoryId_idx" ON "InventoryBatch"("inventoryId");

-- CreateIndex
CREATE INDEX "InventoryBatch_tenantId_idx" ON "InventoryBatch"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryBatch_createdAt_idx" ON "InventoryBatch"("createdAt");

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
