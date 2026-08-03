-- CreateTable
CREATE TABLE "FolderComment" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolderComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FolderComment_folderId_idx" ON "FolderComment"("folderId");

-- AddForeignKey
ALTER TABLE "FolderComment" ADD CONSTRAINT "FolderComment_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderComment" ADD CONSTRAINT "FolderComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
