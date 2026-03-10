import type { NfeItem } from "@/lib/nfe";

export const EXPORT_FIELD_KEYS = [
  "data",
  "chave",
  "numero",
  "valor",
  "itens",
  "status",
  "cest",
  "ncm",
  "cfop",
  "baseCalculo",
] as const;

export type ExportFieldKey = (typeof EXPORT_FIELD_KEYS)[number];

export const EXPORT_FIELD_LABELS: Record<ExportFieldKey, string> = {
  data: "Data",
  chave: "Chave de acesso",
  numero: "NF-e/NFC-e",
  valor: "Valor",
  itens: "Discriminação dos itens",
  status: "Status",
  cest: "CEST",
  ncm: "NCM",
  cfop: "CFOP",
  baseCalculo: "Base de cálculo",
};

const STORAGE_KEY = "fiscal_flow_export_fields";

const DEFAULT_FIELDS: Record<ExportFieldKey, boolean> = {
  data: true,
  chave: true,
  numero: true,
  valor: true,
  itens: true,
  status: true,
  cest: true,
  ncm: true,
  cfop: true,
  baseCalculo: true,
};

export function getExportFields(): Record<ExportFieldKey, boolean> {
  if (typeof window === "undefined") return { ...DEFAULT_FIELDS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FIELDS };
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return { ...DEFAULT_FIELDS, ...parsed };
  } catch {
    return { ...DEFAULT_FIELDS };
  }
}

export function saveExportFields(fields: Record<ExportFieldKey, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
  } catch {
    /* ignore */
  }
}

export function aggregateItemFields(itens: NfeItem[]): {
  cest: string;
  ncm: string;
  cfop: string;
  baseCalculo: number;
} {
  const cestSet = new Set<string>();
  const ncmSet = new Set<string>();
  const cfopSet = new Set<string>();
  let baseCalculo = 0;

  for (const item of itens) {
    if (item.cest?.trim()) cestSet.add(item.cest.trim());
    if (item.ncm?.trim()) ncmSet.add(item.ncm.trim());
    if (item.cfop?.trim()) cfopSet.add(item.cfop.trim());
    baseCalculo += item.vBC ?? 0;
  }

  return {
    cest: Array.from(cestSet).join("; ") || "—",
    ncm: Array.from(ncmSet).join("; ") || "—",
    cfop: Array.from(cfopSet).join("; ") || "—",
    baseCalculo,
  };
}
