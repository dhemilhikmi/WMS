-- CreateTable
CREATE TABLE "Teknisi" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "spesialis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aktif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Teknisi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Teknisi_tenantId_idx" ON "Teknisi"("tenantId");

-- CreateIndex
CREATE INDEX "Teknisi_status_idx" ON "Teknisi"("status");

-- AddForeignKey
ALTER TABLE "Teknisi" ADD CONSTRAINT "Teknisi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
