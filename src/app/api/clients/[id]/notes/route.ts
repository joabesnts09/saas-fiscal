import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth-api";
import { type NfeRecord, recordEnvolveClienteCnpj } from "@/lib/nfe";
import { filterNfeRecordsByOperacao } from "@/lib/auditoria-operacao-filter";
import { paginateNfeItemRows } from "@/lib/auditoria-item-pagination";
import { analyzeFiscal } from "@/lib/fiscal-engine";
import { loadTaxRuleContext, invalidateTaxRuleContextCache } from "@/lib/tax-rule-context";

async function verifyClientAccess(clientId: string, accountId: string) {
  return prisma.client.findFirst({ where: { id: clientId, accountId } });
}

function toNfeRecord(
  row: { chave: string; numero: string; serie: string; dataEmissao: string; valorTotal: number; status: string; tipo: string; emitenteJson: string; destinatarioJson?: string | null; itensJson: string },
  clientCnpj?: string | null
): NfeRecord {
  const emitente = JSON.parse(row.emitenteJson || "{}") as NfeRecord["emitente"] & { cnpjMismatch?: boolean };
  const destinatarioRaw = row.destinatarioJson;
  const destinatario = destinatarioRaw
    ? (() => {
        try {
          const d = JSON.parse(destinatarioRaw) as NonNullable<NfeRecord["destinatario"]>;
          if (!d) return undefined;
          const rs = d.razaoSocial?.trim();
          const cn = d.cnpj?.trim();
          if (!rs && !cn) return undefined;
          return d;
        } catch {
          return undefined;
        }
      })()
    : undefined;
  const itens = JSON.parse(row.itensJson || "[]");
  const destCnpj = destinatario?.cnpj;
  const computedTipo = clientCnpj
    ? computeNotaTipo(emitente?.cnpj, destCnpj === "—" ? undefined : destCnpj, clientCnpj)
    : (row.tipo || "venda");
  return {
    chave: row.chave,
    numero: row.numero,
    serie: row.serie,
    dataEmissao: row.dataEmissao,
    valorTotal: row.valorTotal,
    status: row.status as "Autorizada" | "Cancelada",
    tipo: computedTipo as NfeRecord["tipo"],
    cnpjMismatch: Boolean(emitente.cnpjMismatch),
    emitente: {
      cnpj: emitente.cnpj ?? "",
      razaoSocial: emitente.razaoSocial ?? "",
      endereco: emitente.endereco,
      uf: emitente.uf,
      municipio: emitente.municipio,
      cMun: emitente.cMun,
    },
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
  if (!cc || cc.length < 11) return "outro";
  const ec = onlyDigitsNotes(emitenteCnpj);
  const dc = onlyDigitsNotes(destinatarioCnpj);
  if (ec === cc) return "venda";
  if (dc === cc) return "compra";
  if ((!dc || dc.length < 11) && ec && ec.length >= 11 && ec !== cc) return "compra";
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
    const queryFilter = (searchParams.get("q") ?? "").replace(/\D/g, "");
    const anoFilter = searchParams.get("ano");
    const mesFilter = searchParams.get("mes");

    const dataPrefix =
      mesFilter && /^\d{4}-\d{2}$/.test(mesFilter)
        ? mesFilter
        : anoFilter && /^\d{4}$/.test(anoFilter)
          ? anoFilter
          : null;

    const notes = await prisma.nfeRecord.findMany({
      where: {
        clientId,
        ...(dataPrefix ? { dataEmissao: { startsWith: dataPrefix } } : {}),
      },
      orderBy: { dataEmissao: "desc" },
    });
    const records = notes.map((n) => toNfeRecord(n, client?.cnpj ?? null));
    const filteredByTipo =
      tipoFilter && ["venda", "compra", "outro"].includes(tipoFilter)
        ? records.filter((r) => r.tipo === tipoFilter)
        : records;

    const filteredByQuery =
      queryFilter.length < 2
        ? filteredByTipo
        : filteredByTipo
            .map((r) => {
              const itens = (r.itens ?? []).filter((item) => {
                const ncm = (item.ncm ?? "").replace(/\D/g, "");
                const cest = (item.cest ?? "").replace(/\D/g, "");
                const cfop = (item.cfop ?? "").replace(/\D/g, "");
                return ncm.includes(queryFilter) || cest.includes(queryFilter) || cfop.includes(queryFilter);
              });
              return { ...r, itens };
            })
            .filter((r) => r.itens.length > 0);

    const operacaoRaw = searchParams.get("operacao");
    const operacao: "todos" | "venda" | "compra" =
      operacaoRaw === "venda" || operacaoRaw === "compra" ? operacaoRaw : "todos";
    const afterOperacao =
      operacao === "todos"
        ? filteredByQuery
        : filterNfeRecordsByOperacao(filteredByQuery, operacao, client?.cnpj ?? null);

    const pageParam = searchParams.get("page");
    if (pageParam != null) {
      const page = Math.max(1, parseInt(pageParam, 10) || 1);
      const perPageRaw = parseInt(searchParams.get("perPage") ?? "60", 10);
      const perPage = Math.min(100, Math.max(1, perPageRaw));
      const { pageRecords, total, totalPages, safePage } = paginateNfeItemRows(afterOperacao, page, perPage);
      return NextResponse.json({
        items: pageRecords,
        total,
        page: safePage,
        perPage,
        totalPages,
        unit: "itens",
      });
    }

    return NextResponse.json(afterOperacao);
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
    const allowedRecords = validRecords.filter((r) => recordEnvolveClienteCnpj(r, client.cnpj));
    const rejectedRecords = validRecords.filter((r) => !recordEnvolveClienteCnpj(r, client.cnpj));
    const chavesToImport = allowedRecords.map((r) => r.chave);
    const existing = await prisma.nfeRecord.findMany({
      where: { clientId, chave: { in: chavesToImport } },
      select: { chave: true },
    });
    const existingChaves = new Set(existing.map((e) => e.chave));

    let cnpjMismatchCount = 0;
    const upserts = allowedRecords.map((r) => {
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
    const duplicateCount = allowedRecords.filter((r) => existingChaves.has(r.chave)).length;

    invalidateTaxRuleContextCache();
    const taxCtx = await loadTaxRuleContext(prisma);

    // Motor de análise fiscal: analisar cada nota e persistir alertas
    const allAlerts: {
      clientId: string;
      chave: string;
      itemIndex: number | null;
      productId: string | null;
      tipo: string;
      notaTipo: string | null;
      descricao: string;
      nivel: string;
      detalhes: string | null;
      ruleCode: string | null;
      legalSource: string | null;
    }[] = [];
    for (const r of allowedRecords) {
      const notaTipo = computeNotaTipo(r.emitente?.cnpj, r.destinatario?.cnpj, client.cnpj);
      const alerts = analyzeFiscal({ ...r, tipo: notaTipo }, { cnpj: client.cnpj }, taxCtx);
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
          ruleCode: a.ruleCode ?? null,
          legalSource: a.legalSource ?? null,
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

    return NextResponse.json({
      saved,
      cnpjMismatchCount,
      duplicateCount,
      fiscalAlertsCount: allAlerts.length,
      rejectedCount: rejectedRecords.length,
      rejected: rejectedRecords.map((r) => ({ chave: r.chave, numero: r.numero })),
    });
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
    const year = searchParams.get("year"); // YYYY
    const deleteAll = searchParams.get("all") === "1";
    const body = await request.json().catch(() => ({}));
    const chave = body.chave as string | undefined;

    if (deleteAll) {
      await prisma.fiscalAlert.deleteMany({ where: { clientId } });
      await prisma.prestacaoIncluida.deleteMany({ where: { clientId } });
      const del = await prisma.nfeRecord.deleteMany({ where: { clientId } });
      return NextResponse.json({ deleted: del.count });
    }

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

    const prefix = month && /^\d{4}-\d{2}$/.test(month)
      ? `${month}-`
      : year && /^\d{4}$/.test(year)
        ? year
        : null;

    if (prefix) {
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
      { error: "Informe chave (body), month (?month=YYYY-MM), year (?year=YYYY) ou all=1" },
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
