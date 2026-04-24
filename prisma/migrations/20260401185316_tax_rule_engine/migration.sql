-- AlterTable
ALTER TABLE "FiscalAlert" ADD COLUMN     "legalSource" TEXT,
ADD COLUMN     "ruleCode" TEXT;

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "legalSource" TEXT,
    "defaultSeverity" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "validatorKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfazStItem" (
    "id" TEXT NOT NULL,
    "ncmPattern" TEXT NOT NULL,
    "cest" TEXT NOT NULL,
    "descricao" TEXT,
    "segmento" TEXT,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "vigenteAte" TIMESTAMP(3),
    "legalSource" TEXT NOT NULL DEFAULT 'Convênio ICMS 142/18',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfazStItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_code_key" ON "TaxRule"("code");

-- CreateIndex
CREATE INDEX "ConfazStItem_ncmPattern_idx" ON "ConfazStItem"("ncmPattern");

-- CreateIndex
CREATE INDEX "FiscalAlert_ruleCode_idx" ON "FiscalAlert"("ruleCode");
