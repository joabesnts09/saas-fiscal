import type { NfeItem } from "@/lib/nfe";
import {
  type ConfazStRow,
  findConfazRowsForNcm,
  formatCestForDisplay,
  normalizeCestDigits,
} from "@/lib/confaz-st-core";

export type ConfazStApiItem = {
  ncmPattern: string;
  cest: string;
  descricao?: string | null;
  segmento?: string | null;
  vigenteDesde: string;
  vigenteAte?: string | null;
  legalSource: string;
};

export function confazRowsFromApi(items: ConfazStApiItem[]): ConfazStRow[] {
  return items.map((i) => ({
    ncmPattern: i.ncmPattern,
    cest: i.cest,
    descricao: i.descricao,
    segmento: i.segmento,
    vigenteDesde: new Date(i.vigenteDesde),
    vigenteAte: i.vigenteAte ? new Date(i.vigenteAte) : null,
    legalSource: i.legalSource,
  }));
}

export type ConfazProductEnrichment = {
  /** Há linha na tabela CONFAZ (ST) para o NCM na data da nota */
  sujeitoSt: boolean;
  fundamentoLegal: string | null;
  segmento: string | null;
  descricaoOficial: string | null;
  /** CEST(s) esperados segundo a tabela (formato XX.XXX.XX) */
  cestEsperadosFormatados: string[];
  /** CEST do XML bate com algum esperado (null se sem CEST no XML ou sem tabela) */
  cestXmlCompativel: boolean | null;
  /**
   * O XML não traz “fundamento legal”; o ICMS é efeito da regra tributária.
   * Texto curto para orientar o usuário.
   */
  notaSobreIcms: string | null;
};

function uniqueStrings(arr: (string | null | undefined)[]): string[] {
  return [...new Set(arr.map((s) => (s ?? "").trim()).filter(Boolean))];
}

/**
 * Cruza NCM + data de emissão com a tabela CONFAZ carregada (Convênio 142/18 etc.).
 * Não usa o valor de ICMS para inferir norma — apenas para observação ao lado da regra.
 */
export function enrichProductFromConfaz(
  item: Pick<NfeItem, "ncm" | "cest" | "vICMS" | "vProd">,
  dataEmissao: string | undefined,
  tabela: ConfazStRow[],
  emitDateOverride?: Date | null
): ConfazProductEnrichment {
  const emit =
    emitDateOverride ??
    (() => {
      const ymd = dataEmissao?.trim().slice(0, 10);
      const t = ymd ? Date.parse(ymd) : NaN;
      return Number.isNaN(t) ? null : new Date(t);
    })();

  if (!emit || tabela.length === 0) {
    return {
      sujeitoSt: false,
      fundamentoLegal: null,
      segmento: null,
      descricaoOficial: null,
      cestEsperadosFormatados: [],
      cestXmlCompativel: null,
      notaSobreIcms:
        tabela.length === 0
          ? "Tabela CONFAZ (ST) ainda não carregada ou vazia no sistema."
          : "Data de emissão inválida para consultar vigência da tabela.",
    };
  }

  const rows = findConfazRowsForNcm(item.ncm, tabela, emit);

  if (rows.length === 0) {
    return {
      sujeitoSt: false,
      fundamentoLegal: null,
      segmento: null,
      descricaoOficial: null,
      cestEsperadosFormatados: [],
      cestXmlCompativel: null,
      notaSobreIcms:
        "Nenhuma linha da tabela CONFAZ (ST) encontrada para este NCM nesta data. Confirme o NCM ou amplie o cadastro normativo.",
    };
  }

  const fundamentos = uniqueStrings(rows.map((r) => r.legalSource));
  const segmentos = uniqueStrings(rows.map((r) => r.segmento));
  const descricoes = uniqueStrings(rows.map((r) => r.descricao));
  const cestSet = new Set(rows.map((r) => normalizeCestDigits(r.cest)));
  const cestEsperadosFormatados = [...cestSet].map(formatCestForDisplay);

  const xmlCest = item.cest?.trim() ? normalizeCestDigits(item.cest) : "";
  const cestXmlCompativel =
    !xmlCest ? null : cestSet.has(xmlCest);

  const vIcms = item.vICMS ?? 0;
  const vProd = item.vProd ?? 0;

  let notaSobreIcms =
    "O fundamento legal não vem no XML: ele é obtido pelo cruzamento NCM × tabela CONFAZ. O valor de ICMS informado é consequência da operação (UF, CFOP, CST, ST), não da norma em si.";

  if (vProd > 0 && vIcms === 0) {
    notaSobreIcms +=
      " Com produto sujeito à ST nesta tabela, confira se a operação admite ICMS próprio zerado (ex.: substituição / diferimento) conforme o segmento e a legislação estadual.";
  }

  return {
    sujeitoSt: true,
    fundamentoLegal: fundamentos.join(" · ") || null,
    segmento: segmentos.join(" · ") || null,
    descricaoOficial: descricoes.join(" · ") || null,
    cestEsperadosFormatados,
    cestXmlCompativel,
    notaSobreIcms,
  };
}
