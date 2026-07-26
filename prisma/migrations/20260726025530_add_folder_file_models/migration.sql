-- CreateTable
CREATE TABLE "FolderFile" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "pageCount" INTEGER,
    "fieldTier" TEXT NOT NULL DEFAULT 'plain',
    "formValues" JSONB,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolderFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolderFileAnchor" (
    "id" TEXT NOT NULL,
    "folderFileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "xPct" DOUBLE PRECISION NOT NULL,
    "yPct" DOUBLE PRECISION NOT NULL,
    "widthPct" DOUBLE PRECISION NOT NULL,
    "heightPct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "FolderFileAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FolderFile_folderId_idx" ON "FolderFile"("folderId");

-- CreateIndex
CREATE INDEX "FolderFileAnchor_folderFileId_idx" ON "FolderFileAnchor"("folderFileId");

-- AddForeignKey
ALTER TABLE "FolderFile" ADD CONSTRAINT "FolderFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderFile" ADD CONSTRAINT "FolderFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderFileAnchor" ADD CONSTRAINT "FolderFileAnchor_folderFileId_fkey" FOREIGN KEY ("folderFileId") REFERENCES "FolderFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
