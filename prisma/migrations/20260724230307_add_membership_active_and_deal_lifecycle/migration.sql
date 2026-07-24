-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "parentDealId" TEXT,
ADD COLUMN     "priority" TEXT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Deal_parentDealId_idx" ON "Deal"("parentDealId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_parentDealId_fkey" FOREIGN KEY ("parentDealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
