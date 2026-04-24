import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth-api";

/**
 * Tabela global ST/CEST (Convênio 142/18 etc.) para enriquecimento de itens na auditoria.
 * Autenticado: não expõe dados sensíveis, apenas referência normativa.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth?.accountId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rows = await prisma.confazStItem.findMany({
      orderBy: [{ ncmPattern: "desc" }, { cest: "asc" }],
    });

    const items = rows.map((r) => ({
      id: r.id,
      ncmPattern: r.ncmPattern,
      cest: r.cest,
      descricao: r.descricao,
      segmento: r.segmento,
      vigenteDesde: r.vigenteDesde.toISOString(),
      vigenteAte: r.vigenteAte?.toISOString() ?? null,
      legalSource: r.legalSource,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    console.error("confaz-st GET:", e);
    return NextResponse.json({ error: "Erro ao carregar tabela CONFAZ" }, { status: 500 });
  }
}
