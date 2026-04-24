/**
 * Núcleo ST/CEST (Convênio 142/18 etc.) — sem dependência do Prisma (uso no browser e no servidor).
 */

export type ConfazStRow = {
  ncmPattern: string;
  cest: string;
  descricao?: string | null;
  segmento?: string | null;
  vigenteDesde: Date;
  vigenteAte: Date | null;
  legalSource: string;
};

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

export function normalizeCestDigits(cest: string | undefined | null): string {
  const d = onlyDigits(cest ?? "");
  if (d.length === 0) return "";
  return d.slice(0, 7).padStart(7, "0");
}

export function formatCestForDisplay(raw: string): string {
  const d = onlyDigits(raw).padStart(7, "0").slice(0, 7);
  if (d.length !== 7) return raw.trim() || "—";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 7)}`;
}

export function isConfazVigente(row: ConfazStRow, emitDate: Date): boolean {
  if (emitDate < row.vigenteDesde) return false;
  if (row.vigenteAte != null && emitDate > row.vigenteAte) return false;
  return true;
}

export function findConfazRowsForNcm(
  ncm: string | undefined,
  items: ConfazStRow[],
  emitDate: Date
): ConfazStRow[] {
  const d = onlyDigits(ncm ?? "").slice(0, 8);
  if (d.length < 4) return [];
  const vigente = items.filter((i) => isConfazVigente(i, emitDate));
  let bestLen = 0;
  const out: ConfazStRow[] = [];
  for (const row of vigente) {
    const pat = onlyDigits(row.ncmPattern);
    if (pat.length < 4 || !d.startsWith(pat)) continue;
    if (pat.length > bestLen) {
      bestLen = pat.length;
      out.length = 0;
      out.push(row);
    } else if (pat.length === bestLen) {
      out.push(row);
    }
  }
  return out;
}

export function parseEmitDate(dataEmissao: string | undefined): Date | null {
  if (!dataEmissao?.trim()) return null;
  const ymd = dataEmissao.trim().slice(0, 10);
  const t = Date.parse(ymd);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}
