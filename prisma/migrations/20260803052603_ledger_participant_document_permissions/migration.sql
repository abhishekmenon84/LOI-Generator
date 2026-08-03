-- CreateTable
CREATE TABLE "LedgerParticipant" (
    "id" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'view',
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerParticipant_ledgerId_idx" ON "LedgerParticipant"("ledgerId");

-- CreateIndex
CREATE INDEX "LedgerParticipant_userId_idx" ON "LedgerParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerParticipant_ledgerId_userId_key" ON "LedgerParticipant"("ledgerId", "userId");

-- AddForeignKey
ALTER TABLE "LedgerParticipant" ADD CONSTRAINT "LedgerParticipant_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerParticipant" ADD CONSTRAINT "LedgerParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
