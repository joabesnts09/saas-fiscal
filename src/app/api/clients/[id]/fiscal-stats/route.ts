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
      select: { itensJson: true, tipo: true, dataEmissao: true },
    });

    let totalICMS = 0;
    let vendaCount = 0;
    let compraCount = 0;
    let totalPIS = 0;
    let totalCOFINS = 0;
    let itemsCount = 0;
    let itemsWithFiscalData = 0;
    const cfopCounts: Record<string, number> = {};
    const ncmCounts: Record<string, number> = {};
    const icmsByMonth: Record<string, number> = {};
    const ncmCountsFull: Record<string, number> = {};

    for (const note of notes) {
      if (note.tipo === "venda") vendaCount++;
      else if (note.tipo === "compra") compraCount++;

      const dataEmissao = note.dataEmissao ?? "";
      const monthKey = dataEmissao.length >= 7 ? dataEmissao.slice(0, 7) : "";

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

        const vICMS = item.vICMS ?? 0;
        totalICMS += vICMS;
        totalPIS += item.vPIS ?? 0;
        totalCOFINS += item.vCOFINS ?? 0;

        if (monthKey) {
          icmsByMonth[monthKey] = (icmsByMonth[monthKey] ?? 0) + vICMS;
        }
        if (item.cfop) {
          cfopCounts[item.cfop] = (cfopCounts[item.cfop] ?? 0) + 1;
        }
        if (item.ncm) {
          const ncm4 = item.ncm.replace(/\D/g, "").slice(0, 4);
          if (ncm4) ncmCounts[ncm4] = (ncmCounts[ncm4] ?? 0) + 1;
          const ncm8 = item.ncm.replace(/\D/g, "").slice(0, 8);
          if (ncm8.length >= 4) ncmCountsFull[ncm8] = (ncmCountsFull[ncm8] ?? 0) + 1;
        }
      }
    }

    const topCfops = Object.entries(cfopCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cfop, count]) => ({ cfop, count }));

    const topNcms = Object.entries(ncmCountsFull)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ncm, count]) => ({ ncm, count }));

    const icmsByMonthList = Object.entries(icmsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valor]) => ({ mes, valor }));

    return NextResponse.json({
      notesCount: notes.length,
      vendaCount,
      compraCount,
      itemsCount,
      itemsWithFiscalData,
      totalICMS,
      totalPIS,
      totalCOFINS,
      topCfops,
      topNcms,
      icmsByMonth: icmsByMonthList,
      hasFiscalData: itemsWithFiscalData > 0,
    });
  } catch (error) {
    console.error("Fiscal stats error:", error);
    return NextResponse.json({ error: "Erro ao buscar estatísticas" }, { status: 500 });
  }
}
