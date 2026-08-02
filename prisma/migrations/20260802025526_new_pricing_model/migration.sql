/*
  Warnings:

  - You are about to drop the column `documentsCreated` on the `UsageCounter` table. All the data in the column will be lost.
  - Added the required column `dayStart` to the `UsageCounter` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UsageCounter" DROP COLUMN "documentsCreated",
ADD COLUMN     "dayCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dayStart" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "monthCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pendingOverageCents" INTEGER NOT NULL DEFAULT 0;
