-- AlterTable
ALTER TABLE "SignatureRequest" ADD COLUMN     "integrityCheckFailedAt" TIMESTAMP(3),
ADD COLUMN     "lastIntegrityCheckAt" TIMESTAMP(3);
