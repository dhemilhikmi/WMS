-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'main_service';

-- CreateIndex
CREATE INDEX "Workshop_parentId_idx" ON "Workshop"("parentId");

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
