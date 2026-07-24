-- CreateTable
CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifyCode" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignerSlot" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'signer',
    "role" TEXT NOT NULL,
    "roleOtherLabel" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "signingToken" TEXT,
    "tokenUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignerSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureEvent" (
    "id" TEXT NOT NULL,
    "signerSlotId" TEXT NOT NULL,
    "signatureImageUrl" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "screenInfo" TEXT NOT NULL,
    "timezoneOffset" INTEGER NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "geoCountry" TEXT,
    "geoRegion" TEXT,
    "geoCity" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequest_verifyCode_key" ON "SignatureRequest"("verifyCode");

-- CreateIndex
CREATE INDEX "SignatureRequest_dealId_idx" ON "SignatureRequest"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "SignerSlot_signingToken_key" ON "SignerSlot"("signingToken");

-- CreateIndex
CREATE INDEX "SignerSlot_requestId_idx" ON "SignerSlot"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureEvent_signerSlotId_key" ON "SignatureEvent"("signerSlotId");

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignerSlot" ADD CONSTRAINT "SignerSlot_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_signerSlotId_fkey" FOREIGN KEY ("signerSlotId") REFERENCES "SignerSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
