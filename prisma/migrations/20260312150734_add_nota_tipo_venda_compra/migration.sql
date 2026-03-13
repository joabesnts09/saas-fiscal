-- AlterTable
ALTER TABLE "FiscalAlert" ADD COLUMN     "notaTipo" TEXT;

-- AlterTable
ALTER TABLE "NfeRecord" ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'venda';
