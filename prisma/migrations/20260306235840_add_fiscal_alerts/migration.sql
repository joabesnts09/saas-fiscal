-- CreateTable
CREATE TABLE "FiscalAlert" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "itemIndex" INTEGER,
    "productId" TEXT,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "detalhes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalAlert_clientId_idx" ON "FiscalAlert"("clientId");

-- CreateIndex
CREATE INDEX "FiscalAlert_clientId_chave_idx" ON "FiscalAlert"("clientId", "chave");

-- AddForeignKey
ALTER TABLE "FiscalAlert" ADD CONSTRAINT "FiscalAlert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
