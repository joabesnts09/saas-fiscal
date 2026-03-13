-- CreateTable
CREATE TABLE "ExportConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fieldsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExportConfig_clientId_key" ON "ExportConfig"("clientId");

-- AddForeignKey
ALTER TABLE "ExportConfig" ADD CONSTRAINT "ExportConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
