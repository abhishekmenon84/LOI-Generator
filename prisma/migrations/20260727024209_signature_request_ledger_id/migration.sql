-- AlterTable
ALTER TABLE "SignatureRequest" ADD COLUMN     "ledgerId" TEXT;

-- CreateIndex
CREATE INDEX "SignatureRequest_ledgerId_idx" ON "SignatureRequest"("ledgerId");

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
