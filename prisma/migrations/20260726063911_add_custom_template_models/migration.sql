-- CreateTable
CREATE TABLE "CustomTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateAnchor" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "xPct" DOUBLE PRECISION NOT NULL,
    "yPct" DOUBLE PRECISION NOT NULL,
    "widthPct" DOUBLE PRECISION NOT NULL,
    "heightPct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TemplateAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomTemplate_orgId_idx" ON "CustomTemplate"("orgId");

-- CreateIndex
CREATE INDEX "TemplateAnchor_templateId_idx" ON "TemplateAnchor"("templateId");

-- AddForeignKey
ALTER TABLE "CustomTemplate" ADD CONSTRAINT "CustomTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomTemplate" ADD CONSTRAINT "CustomTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateAnchor" ADD CONSTRAINT "TemplateAnchor_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CustomTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
