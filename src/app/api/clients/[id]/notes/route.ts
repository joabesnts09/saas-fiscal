import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth-api";
import type { NfeRecord } from "@/lib/nfe";
import { analyzeFiscal } from "@/lib/fiscal-engine";

async function verifyClientAccess(clientId: string, accountId: string) {
  return prisma.client.findFirst({ where: { id: clientId, accountId } });
}

function toNfeRecord(row: { chave: string; numero: string; serie: string; dataEmissao: string; valorTotal: number; status: string; tipo: string; emitenteJson: string; destinatarioJson?: string | null; itensJson: string }): NfeRecord {
  const emitente = JSON.parse(row.emitenteJson || "{}");
  const destinatarioRaw = row.destinatarioJson;
  const destinatario = destinatarioRaw
    ? (() => {
        try {
          const d = JSON.parse(destinatarioRaw) as { cnpj?: string; razaoSocial?: string; endereco?: string };
          if (!d) return undefined;
          const rs = d.razaoSocial?.trim();
          const cn = d.cnpj?.trim();
          if (!rs && !cn) return undefined;
          return { cnpj: cn || "—", razaoSocial: rs || "—", endereco: d.endereco };
        } catch {
          return undefined;
        }
      })()
    : undefined;
  const itens = JSON.parse(row.itensJson || "[]");
  return {
    chave: row.chave,
    numero: row.numero,
    serie: row.serie,
    dataEmissao: row.dataEmissao,
    valorTotal: row.valorTotal,
    status: row.status as "Autorizada" | "Cancelada",
    tipo: (row.tipo || "venda") as NfeRecord["tipo"],
    cnpjMismatch: Boolean(emitente.cnpjMismatch),
    emitente: { cnpj: emitente.cnpj ?? "", razaoSocial: emitente.razaoSocial ?? "", endereco: emitente.endereco },
    destinatario,
    itens,
  };
}

const onlyDigitsNotes = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

function computeNotaTipo(
  emitenteCnpj: string | undefined,
  destinatarioCnpj: string | undefined,
  clientCnpj: string | null | undefined
): "venda" | "compra" | "outro" {
  const cc = onlyDigitsNotes(clientCnpj);
  if (!cc) return "outro";
  const ec = onlyDigitsNotes(emitenteCnpj);
  const dc = onlyDigitsNotes(destinatarioCnpj);
  if (ec === cc) return "venda";
  if (dc === cc) return "compra";
  return "outro";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { id: clientId } = await params;
    const client = await verifyClientAccess(clientId, accountId);
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const tipoFilter = searchParams.get("tipo");

    const where: { clientId: string; tipo?: string } = { clientId };
    if (tipoFilter && ["venda", "compra", "outro"].includes(tipoFilter)) {
      where.tipo = tipoFilter;
    }

    const notes = await prisma.nfeRecord.findMany({ where, orderBy: { dataEmissao: "desc" } });
    return NextResponse.json(notes.map(toNfeRecord));
  } catch (error) {
    console.error("Notes GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar notas" }, { status: 500 });
  }
}

const FREE_PLAN_IMPORT_LIMIT = 20;
const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

function cnpjMatches(recordCnpj: string | undefined, clientCnpj: string | null | undefined): boolean {
  const rc = onlyDigits(recordCnpj ?? "");
  const cc = onlyDigits(clientCnpj ?? "");
  if (!rc || !cc) return true;
  return rc === cc;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { id: clientId } = await params;
    const client = await verifyClientAccess(clientId, accountId);
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    const body = await request.json();
    const records = Array.isArray(body) ? body : body.records ?? [];
    if (!Array.isArray(records) || records.length === 0) return NextResponse.json({ error: "Nenhuma nota enviada" }, { status: 400 });

    const plan = auth.plan ?? "free";
    if (plan === "free" && records.length > FREE_PLAN_IMPORT_LIMIT) {
      return NextResponse.json(
        { error: `Plano Free permite importar até ${FREE_PLAN_IMPORT_LIMIT} notas por vez. Faça upgrade para importar mais.` },
        { status: 403 }
      );
    }
    const validRecords = (records as NfeRecord[]).filter((r) => r?.chave);
    const chavesToImport = validRecords.map((r) => r.chave);
    const existing = await prisma.nfeRecord.findMany({
      where: { clientId, chave: { in: chavesToImport } },
      select: { chave: true },
    });
    const existingChaves = new Set(existing.map((e) => e.chave));

    let cnpjMismatchCount = 0;
    const upserts = validRecords.map((r) => {
      const tipo = computeNotaTipo(r.emitente?.cnpj, r.destinatario?.cnpj, client.cnpj);
      // Apenas em notas de venda o emitente deve ser a empresa; em compras, o emitente é o fornecedor (CNPJ diferente é esperado)
      const hasMismatch = tipo === "venda" && !cnpjMatches(r.emitente?.cnpj, client.cnpj);
      if (hasMismatch) cnpjMismatchCount++;
      const emitenteData = { ...(r.emitente ?? {}), cnpjMismatch: hasMismatch };
      const destinatarioData = r.destinatario ? JSON.stringify(r.destinatario) : null;
      return prisma.nfeRecord.upsert({
        where: { clientId_chave: { clientId, chave: r.chave } },
        create: {
          clientId,
          chave: r.chave,
          numero: r.numero ?? "",
          serie: r.serie ?? "",
          dataEmissao: r.dataEmissao ?? "",
          valorTotal: r.valorTotal ?? 0,
          status: r.status ?? "Autorizada",
          tipo,
          emitenteJson: JSON.stringify(emitenteData),
          destinatarioJson: destinatarioData,
          itensJson: JSON.stringify(r.itens ?? []),
        },
        update: {
          numero: r.numero ?? "",
          serie: r.serie ?? "",
          dataEmissao: r.dataEmissao ?? "",
          valorTotal: r.valorTotal ?? 0,
          status: r.status ?? "Autorizada",
          tipo,
          emitenteJson: JSON.stringify(emitenteData),
          destinatarioJson: destinatarioData,
          itensJson: JSON.stringify(r.itens ?? []),
        },
      });
    });
    const results = await Promise.allSettled(upserts);
    const saved = results.filter((r) => r.status === "fulfilled").length;
    const duplicateCount = validRecords.filter((r) => existingChaves.has(r.chave)).length;

    // Motor de análise fiscal: analisar cada nota e persistir alertas
    const allAlerts: { clientId: string; chave: string; itemIndex: number | null; productId: string | null; tipo: string; notaTipo: string | null; descricao: string; nivel: string; detalhes: string | null }[] = [];
    for (const r of validRecords) {
      const notaTipo = computeNotaTipo(r.emitente?.cnpj, r.destinatario?.cnpj, client.cnpj);
      const alerts = analyzeFiscal({ ...r, tipo: notaTipo }, { cnpj: client.cnpj });
      for (const a of alerts) {
        allAlerts.push({
          clientId,
          chave: a.chave,
          itemIndex: a.itemIndex ?? null,
          productId: a.productId ?? null,
          tipo: a.tipo,
          notaTipo,
          descricao: a.descricao,
          nivel: a.nivel,
          detalhes: a.detalhes ? JSON.stringify(a.detalhes) : null,
        });
      }
    }
    if (allAlerts.length > 0 || chavesToImport.length > 0) {
      await prisma.fiscalAlert.deleteMany({
        where: { clientId, chave: { in: chavesToImport } },
      });
      if (allAlerts.length > 0) {
        await prisma.fiscalAlert.createMany({ data: allAlerts });
      }
    }

    return NextResponse.json({ saved, cnpjMismatchCount, duplicateCount, fiscalAlertsCount: allAlerts.length });
  } catch (error) {
    console.error("Notes POST error:", error);
    return NextResponse.json({ error: "Erro ao salvar notas" }, { status: 500 });
  }
}

export async function DELETE(
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
    const month = searchParams.get("month"); // YYYY-MM
    const body = await request.json().catch(() => ({}));
    const chave = body.chave as string | undefined;

    if (chave) {
      await prisma.fiscalAlert.deleteMany({ where: { clientId, chave } });
      await prisma.prestacaoIncluida.deleteMany({
        where: { clientId, chave },
      });
      await prisma.nfeRecord.deleteMany({
        where: { clientId, chave },
      });
      return NextResponse.json({ deleted: 1 });
    }

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const prefix = `${month}-`;
      const records = await prisma.nfeRecord.findMany({
        where: {
          clientId,
          dataEmissao: { startsWith: prefix },
        },
        select: { chave: true },
      });
      const chaves = records.map((r) => r.chave);
      if (chaves.length > 0) {
        await prisma.fiscalAlert.deleteMany({ where: { clientId, chave: { in: chaves } } });
        await prisma.prestacaoIncluida.deleteMany({
          where: { clientId, chave: { in: chaves } },
        });
        await prisma.nfeRecord.deleteMany({
          where: { clientId, chave: { in: chaves } },
        });
      }
      return NextResponse.json({ deleted: chaves.length });
    }

    return NextResponse.json(
      { error: "Informe chave (body) ou month (query: ?month=YYYY-MM)" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Notes DELETE error:", error);
    return NextResponse.json({ error: "Erro ao excluir notas" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { id: clientId } = await params;
    const client = await verifyClientAccess(clientId, accountId);
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    const body = await request.json();
    const { chave, valorTotal } = body;
    if (!chave || typeof valorTotal !== "number") return NextResponse.json({ error: "chave e valorTotal obrigatórios" }, { status: 400 });
    await prisma.nfeRecord.updateMany({
      where: { clientId, chave },
      data: { valorTotal },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notes PATCH error:", error);
    return NextResponse.json({ error: "Erro ao atualizar nota" }, { status: 500 });
  }
}
