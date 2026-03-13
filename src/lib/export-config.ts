import { formatDate, formatCurrency, formatCnpj } from "@/lib/nfe";
import { aggregateItemFields } from "@/lib/export-fields";
import type { NfeRecord, NfeItem } from "@/lib/nfe";
import { summarizeItems } from "@/lib/nfe";

export const EXPORT_FIELD_KEYS = [
  "data",
  "chave",
  "emitente",
  "destinatario",
  "numero",
  "serie",
  "valor",
  "itens",
  "status",
  "tipo",
  "cest",
  "ncm",
  "cfop",
  "baseCalculo",
  "vICMS",
  "vPIS",
  "vCOFINS",
] as const;

export type ExportFieldKey = (typeof EXPORT_FIELD_KEYS)[number];

export const EXPORT_FIELD_LABELS: Record<ExportFieldKey, string> = {
  data: "Data",
  chave: "Chave de acesso",
  emitente: "Emitente",
  destinatario: "Destinatário",
  numero: "NF-e/NFC-e",
  serie: "Série",
  valor: "Valor",
  itens: "Descrição dos itens",
  status: "Status",
  tipo: "Operação",
  cest: "CEST",
  ncm: "NCM",
  cfop: "CFOP",
  baseCalculo: "Base de cálculo ICMS",
  vICMS: "ICMS",
  vPIS: "PIS",
  vCOFINS: "COFINS",
};

export const DEFAULT_EXPORT_FIELDS: ExportFieldKey[] = [
  "data",
  "chave",
  "emitente",
  "destinatario",
  "numero",
  "valor",
  "itens",
  "status",
];

export function getRecordRow(
  record: NfeRecord,
  fieldKeys: ExportFieldKey[]
): Record<string, string | number> {
  const agg = aggregateItemFields(record.itens);
  const tipoLabel =
    record.tipo === "compra" ? "Compra" : record.tipo === "venda" ? "Venda" : "Outro";

  const fmtDoc = (r?: { razaoSocial?: string; cnpj?: string }) => {
    const nome = r?.razaoSocial?.trim() || "—";
    const doc = r?.cnpj?.trim();
    if (!doc || doc === "—") return nome;
    const formatted = formatCnpj(doc);
    const label = doc.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ";
    return `${nome}\n${label}: ${formatted}`;
  };
  const valueMap: Record<string, string | number> = {
    data: formatDate(record.dataEmissao),
    chave: record.chave,
    emitente: fmtDoc(record.emitente),
    destinatario: fmtDoc(record.destinatario),
    numero: record.numero,
    serie: record.serie,
    valor: record.valorTotal,
    itens: summarizeItems(record.itens),
    status: record.status,
    tipo: tipoLabel,
    cest: agg.cest,
    ncm: agg.ncm,
    cfop: agg.cfop,
    baseCalculo: agg.baseCalculo,
    vICMS: record.itens.reduce((a, i) => a + (i.vICMS ?? 0), 0),
    vPIS: record.itens.reduce((a, i) => a + (i.vPIS ?? 0), 0),
    vCOFINS: record.itens.reduce((a, i) => a + (i.vCOFINS ?? 0), 0),
  };

  const result: Record<string, string | number> = {};
  for (const key of fieldKeys) {
    const label = EXPORT_FIELD_LABELS[key];
    const val = valueMap[key];
    if (label != null) result[label] = val ?? "—";
  }
  return result;
}

export function getRecordRowFormatted(
  record: NfeRecord,
  fieldKeys: ExportFieldKey[]
): Record<string, string | number> {
  const row = getRecordRow(record, fieldKeys);
  const formatted: Record<string, string | number> = {};
  for (const [label, val] of Object.entries(row)) {
    if (typeof val === "number" && (label === "Valor" || label.includes("ICMS") || label.includes("PIS") || label.includes("COFINS") || label.includes("cálculo"))) {
      formatted[label] = formatCurrency(val);
    } else {
      formatted[label] = val;
    }
  }
  return formatted;
}

/** Auditoria fiscal: uma linha por produto (item). Notas sem itens geram 1 linha com campos de item em branco. */
export function getRecordRowsByItem(
  record: NfeRecord,
  fieldKeys: ExportFieldKey[],
  clientCnpj?: string | null
): Record<string, string | number>[] {
  const tipoLabel =
    record.tipo === "compra" ? "Compra" : record.tipo === "venda" ? "Venda" : "Outro";
  const fmtDoc = (r?: { razaoSocial?: string; cnpj?: string }) => {
    const nome = r?.razaoSocial?.trim() || "—";
    const doc = r?.cnpj?.trim();
    if (!doc || doc === "—") return nome;
    const formatted = formatCnpj(doc);
    const label = doc.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ";
    return `${nome}\n${label}: ${formatted}`;
  };
  const destCnpjRaw = record.destinatario?.cnpj?.trim() && record.destinatario.cnpj !== "—"
    ? record.destinatario.cnpj
    : null;
  const destCnpj = destCnpjRaw ?? (
    (record.tipo === "compra" || record.tipo === "outro") &&
    clientCnpj &&
    (clientCnpj.replace(/\D/g, "") ?? "").length === 14
      ? clientCnpj
      : null
  );
  const destForFmt = record.destinatario
    ? { ...record.destinatario, cnpj: destCnpj ?? record.destinatario.cnpj }
    : undefined;
  const notaBase = {
    data: formatDate(record.dataEmissao),
    chave: record.chave,
    emitente: fmtDoc(record.emitente),
    destinatario: fmtDoc(destForFmt),
    numero: record.numero,
    serie: record.serie,
    status: record.status,
    tipo: tipoLabel,
  };

  const itens = record.itens?.length ? record.itens : [null as unknown as NfeItem];
  const rows: Record<string, string | number>[] = [];

  for (const item of itens) {
    const valor = item ? (item.vProd ?? 0) : record.valorTotal;
    const valueMap: Record<string, string | number> = {
      ...notaBase,
      valor,
      itens: item ? item.description : "—",
      cest: item?.cest?.trim() ?? "—",
      ncm: item?.ncm?.trim() ?? "—",
      cfop: item?.cfop?.trim() ?? "—",
      baseCalculo: item?.vBC ?? 0,
      vICMS: item?.vICMS ?? 0,
      vPIS: item?.vPIS ?? 0,
      vCOFINS: item?.vCOFINS ?? 0,
    };

    const result: Record<string, string | number> = {};
    for (const key of fieldKeys) {
      const label = EXPORT_FIELD_LABELS[key];
      const val = valueMap[key];
      if (label != null) result[label] = val ?? "—";
    }
    rows.push(result);
  }
  return rows;
}

/** Auditoria fiscal: versão formatada (Valor, ICMS etc em moeda). */
export function getRecordRowsByItemFormatted(
  record: NfeRecord,
  fieldKeys: ExportFieldKey[],
  clientCnpj?: string | null
): Record<string, string | number>[] {
  const rows = getRecordRowsByItem(record, fieldKeys, clientCnpj);
  return rows.map((row) => {
    const formatted: Record<string, string | number> = {};
    for (const [label, val] of Object.entries(row)) {
      if (typeof val === "number" && (label === "Valor" || label.includes("ICMS") || label.includes("PIS") || label.includes("COFINS") || label.includes("cálculo"))) {
        formatted[label] = formatCurrency(val);
      } else {
        formatted[label] = val;
      }
    }
    return formatted;
  });
}
