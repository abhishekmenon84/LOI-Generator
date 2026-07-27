-- DropForeignKey
ALTER TABLE "SignatureRequest" DROP CONSTRAINT "SignatureRequest_dealId_fkey";

-- DropIndex
DROP INDEX "SignatureRequest_dealId_idx";

-- AlterTable
ALTER TABLE "SignatureRequest" DROP COLUMN "dealId",
ALTER COLUMN "ledgerId" SET NOT NULL;
