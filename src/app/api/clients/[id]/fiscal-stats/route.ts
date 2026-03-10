import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth-api";

async function verifyClientAccess(clientId: string, accountId: string) {
  return prisma.client.findFirst({ where: { id: clientId, accountId } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(_request);
    const accountId = auth?.accountId;
    if (!accountId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { id: clientId } = await params;
    const client = await verifyClientAccess(clientId, accountId);
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const notes = await prisma.nfeRecord.findMany({
      where: { clientId },
      select: { itensJson: true },
    });

    let totalICMS = 0;
    let totalPIS = 0;
    let totalCOFINS = 0;
    let itemsCount = 0;
    let itemsWithFiscalData = 0;
    const cfopCounts: Record<string, number> = {};
    const ncmCounts: Record<string, number> = {};

    for (const note of notes) {
      const itens = (() => {
        try {
          return JSON.parse(note.itensJson || "[]") as Array<{
            vICMS?: number;
            vPIS?: number;
            vCOFINS?: number;
            ncm?: string;
            cfop?: string;
          }>;
        } catch {
          return [];
        }
      })();

      for (const item of itens) {
        itemsCount++;
        const hasFiscal = !!(item.ncm || item.cfop || (item.vICMS != null && item.vICMS > 0) || (item.vPIS != null && item.vPIS > 0) || (item.vCOFINS != null && item.vCOFINS > 0));
        if (hasFiscal) itemsWithFiscalData++;

        totalICMS += item.vICMS ?? 0;
        totalPIS += item.vPIS ?? 0;
        totalCOFINS += item.vCOFINS ?? 0;

        if (item.cfop) {
          cfopCounts[item.cfop] = (cfopCounts[item.cfop] ?? 0) + 1;
        }
        if (item.ncm) {
          const ncm = item.ncm.replace(/\D/g, "").slice(0, 4);
          if (ncm) ncmCounts[ncm] = (ncmCounts[ncm] ?? 0) + 1;
        }
      }
    }

    const topCfops = Object.entries(cfopCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cfop, count]) => ({ cfop, count }));

    return NextResponse.json({
      notesCount: notes.length,
      itemsCount,
      itemsWithFiscalData,
      totalICMS,
      totalPIS,
      totalCOFINS,
      topCfops,
      hasFiscalData: itemsWithFiscalData > 0,
    });
  } catch (error) {
    console.error("Fiscal stats error:", error);
    return NextResponse.json({ error: "Erro ao buscar estatísticas" }, { status: 500 });
  }
}
