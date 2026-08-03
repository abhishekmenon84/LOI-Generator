-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "businessAddress" TEXT,
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "businessPhone" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "retentionDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "verificationApprovedAt" TIMESTAMP(3),
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
ADD COLUMN     "verificationSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BusinessVerificationDocument" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileHash" TEXT,
    "fileSizeBytes" INTEGER,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessVerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessVerificationDocument_orgId_key" ON "BusinessVerificationDocument"("orgId");

-- CreateIndex
CREATE INDEX "BusinessVerificationDocument_orgId_idx" ON "BusinessVerificationDocument"("orgId");

-- AddForeignKey
ALTER TABLE "BusinessVerificationDocument" ADD CONSTRAINT "BusinessVerificationDocument_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessVerificationDocument" ADD CONSTRAINT "BusinessVerificationDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
