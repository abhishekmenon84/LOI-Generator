-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'draft';

-- CreateTable
CREATE TABLE "DealShare" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "grantedToUserId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'read',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealShare_dealId_idx" ON "DealShare"("dealId");

-- CreateIndex
CREATE INDEX "DealShare_grantedToUserId_idx" ON "DealShare"("grantedToUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DealShare_dealId_grantedToUserId_key" ON "DealShare"("dealId", "grantedToUserId");

-- AddForeignKey
ALTER TABLE "DealShare" ADD CONSTRAINT "DealShare_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealShare" ADD CONSTRAINT "DealShare_grantedToUserId_fkey" FOREIGN KEY ("grantedToUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealShare" ADD CONSTRAINT "DealShare_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
