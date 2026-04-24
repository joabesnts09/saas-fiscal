import type { NfeRecord } from "@/lib/nfe";

/**
 * Pagina a tabela "por itens" (1 linha = 1 item da nota), na ordem: notas em sequência, itens 0..n.
 */
export function paginateNfeItemRows(
  records: NfeRecord[],
  page: number,
  perPage: number
): { pageRecords: NfeRecord[]; total: number; totalPages: number; safePage: number } {
  const flat: { chave: string; i: number }[] = [];
  for (const r of records) {
    for (let i = 0; i < r.itens.length; i++) {
      flat.push({ chave: r.chave, i });
    }
  }
  const total = flat.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / perPage);
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * perPage;
  const part = flat.slice(start, start + perPage);
  if (part.length === 0) {
    return { pageRecords: [], total, totalPages, safePage };
  }
  const chOrder: string[] = [];
  const byCh = new Map<string, number[]>();
  for (const { chave, i } of part) {
    if (!byCh.has(chave)) {
      chOrder.push(chave);
      byCh.set(chave, []);
    }
    byCh.get(chave)!.push(i);
  }
  const byChaveRecord = new Map<string, NfeRecord>(records.map((r) => [r.chave, r]));
  const pageRecords: NfeRecord[] = [];
  for (const ch of chOrder) {
    const idxs = (byCh.get(ch) ?? []).sort((a, b) => a - b);
    const r = byChaveRecord.get(ch);
    if (!r) {
      continue;
    }
    const itens = idxs.map((j) => r.itens[j]);
    pageRecords.push({ ...r, itens });
  }
  return { pageRecords, total, totalPages, safePage };
}
