-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'individual',
    "isPersonal" BOOLEAN NOT NULL DEFAULT true,
    "planTier" TEXT NOT NULL DEFAULT 'trial',
    "trialEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key" ON "Organization"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add new Deal columns as NULLABLE first (backfill happens before NOT NULL is enforced)
ALTER TABLE "Deal" ADD COLUMN     "orgId" TEXT,
ADD COLUMN     "createdByUserId" TEXT;

-- Backfill: one personal Organization + admin Membership per existing User
INSERT INTO "Organization" ("id", "name", "accountType", "isPersonal", "planTier", "createdAt", "updatedAt")
SELECT
  'org_' || "id",
  COALESCE("name", "email") || '''s Workspace',
  'individual',
  true,
  'trial',
  NOW(),
  NOW()
FROM "User";

INSERT INTO "Membership" ("id", "userId", "orgId", "role", "createdAt")
SELECT
  'mem_' || "User"."id",
  "User"."id",
  'org_' || "User"."id",
  'admin',
  NOW()
FROM "User";

-- Backfill: point every existing Deal at its creator's new personal Organization
UPDATE "Deal"
SET "orgId" = 'org_' || "userId", "createdByUserId" = "userId"
WHERE "orgId" IS NULL;

-- AlterTable: now that all rows are backfilled, enforce NOT NULL
ALTER TABLE "Deal" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Deal" ALTER COLUMN "createdByUserId" SET NOT NULL;

-- DropForeignKey (old ownership edge)
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_userId_fkey";

-- DropIndex (old ownership index)
DROP INDEX "Deal_userId_idx";

-- DropColumn (old ownership column)
ALTER TABLE "Deal" DROP COLUMN "userId";

-- CreateIndex
CREATE INDEX "Deal_orgId_idx" ON "Deal"("orgId");

-- CreateIndex
CREATE INDEX "Deal_createdByUserId_idx" ON "Deal"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
