/*
  Warnings:

  - Added the required column `snapshotDocumentType` to the `SignatureRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `snapshotFormData` to the `SignatureRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SignatureRequest" ADD COLUMN     "snapshotDocumentType" TEXT NOT NULL,
ADD COLUMN     "snapshotFormData" JSONB NOT NULL,
ADD COLUMN     "snapshotTemplateId" TEXT;
