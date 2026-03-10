import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth-api";
import { analyzeFiscal } from "@/lib/fiscal-engine";
import type { NfeRecord } from "@/lib/nfe";

async function verifyClientAccess(clientId: string, accountId: string) {
  return prisma.client.findFirst({ where: { id: clientId, accountId } });
}

function toNfeRecord(row: { chave: string; numero: string; serie: string; dataEmissao: string; valorTotal: number; status: string; emitenteJson: string; itensJson: string }): NfeRecord {
  const emitente = JSON.parse(row.emitenteJson || "{}");
  const itens = JSON.parse(row.itensJson || "[]");
  return {
    chave: row.chave,
    numero: row.numero,
    serie: row.serie,
    dataEmissao: row.dataEmissao,
    valorTotal: row.valorTotal,
    status: row.status as "Autorizada" | "Cancelada",
    cnpjMismatch: Boolean(emitente.cnpjMismatch),
    emitente: { cnpj: emitente.cnpj ?? "", razaoSocial: emitente.razaoSocial ?? "", endereco: emitente.endereco },
    itens,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { id: clientId } = await params;
    const client = await verifyClientAccess(clientId, accountId);
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const notes = await prisma.nfeRecord.findMany({
      where: { clientId },
      orderBy: { dataEmissao: "desc" },
    });
    const records = notes.map(toNfeRecord);

    const allAlerts: { clientId: string; chave: string; itemIndex: number | null; productId: string | null; tipo: string; descricao: string; nivel: string; detalhes: string | null }[] = [];
    for (const r of records) {
      const alerts = analyzeFiscal(r, { cnpj: client.cnpj });
      for (const a of alerts) {
        allAlerts.push({
          clientId,
          chave: a.chave,
          itemIndex: a.itemIndex ?? null,
          productId: a.productId ?? null,
          tipo: a.tipo,
          descricao: a.descricao,
          nivel: a.nivel,
          detalhes: a.detalhes ? JSON.stringify(a.detalhes) : null,
        });
      }
    }

    await prisma.fiscalAlert.deleteMany({ where: { clientId } });
    if (allAlerts.length > 0) {
      await prisma.fiscalAlert.createMany({ data: allAlerts });
    }

    return NextResponse.json({ analyzed: records.length, alertsCount: allAlerts.length });
  } catch (error) {
    console.error("Fiscal alerts analyze error:", error);
    return NextResponse.json({ error: "Erro ao analisar notas" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { id: clientId } = await params;
    const client = await verifyClientAccess(clientId, accountId);
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const chave = searchParams.get("chave");
    const nivel = searchParams.get("nivel");
    const tipo = searchParams.get("tipo");

    const where: { clientId: string; chave?: string; nivel?: string; tipo?: string } = {
      clientId,
    };
    if (chave) where.chave = chave;
    if (nivel) where.nivel = nivel;
    if (tipo) where.tipo = tipo;

    const alerts = await prisma.fiscalAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("Fiscal alerts GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar alertas fiscais" }, { status: 500 });
  }
}
