import { XMLParser } from "fast-xml-parser";

export type NfeItem = {
  productId: string;
  description: string;
  cest: string;
  quantity: number;
  // Campos fiscais (prod)
  ncm?: string;
  cfop?: string;
  uCom?: string;
  vUnCom?: number;
  vProd?: number;
  // ICMS
  orig?: string;
  cst?: string;
  modBC?: string;
  vBC?: number;
  pICMS?: number;
  vICMS?: number;
  // PIS
  cstPis?: string;
  vBCPis?: number;
  pPIS?: number;
  vPIS?: number;
  // COFINS
  cstCofins?: string;
  vBCCofins?: number;
  pCOFINS?: number;
  vCOFINS?: number;
  // IPI
  cstIpi?: string;
  /** Reforma tributária — grupo IBSCBS no XML (vIBS / totais no item) */
  vIBS?: number;
  /** Reforma tributária — grupo IBSCBS no XML (vCBS) */
  vCBS?: number;
};

/** UF, município e código IBGE quando presentes no endereço da NF-e */
export type NfeLocalidade = {
  uf?: string;
  municipio?: string;
  cMun?: string;
};

export type NotaTipo = "venda" | "compra" | "outro";

export type NfeRecord = {
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  valorTotal: number;
  status: "Autorizada" | "Cancelada";
  cnpjMismatch?: boolean;
  tipo?: NotaTipo;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    endereco?: string;
  } & NfeLocalidade;
  destinatario?: {
    cnpj: string;
    razaoSocial: string;
    endereco?: string;
  } & NfeLocalidade;
  itens: NfeItem[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  allowBooleanAttributes: true,
});

const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const parseNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value.replace(",", "."));
  return 0;
};

/** CNPJ/CPF só dígitos — para cruzar emitente/destinatário com o cadastro da empresa */
export const onlyDigitsDoc = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * A nota deve envolver o documento da empresa (emitente ou destinatário).
 * Sem CPF/CNPJ no cadastro (menos de 11 dígitos), não bloqueia importação.
 */
export function recordEnvolveClienteCnpj(record: NfeRecord, clientDoc: string | null | undefined): boolean {
  const cc = onlyDigitsDoc(clientDoc);
  if (cc.length < 11) return true;
  const ec = onlyDigitsDoc(record.emitente?.cnpj);
  const dc = onlyDigitsDoc(record.destinatario?.cnpj);
  return ec === cc || dc === cc;
}

/** Exibição: UF e município (CONFAZ / fiscal — origem e destino da operação) */
export function formatLocalidadeParticipante(part?: NfeLocalidade | null): string {
  const u = part?.uf?.trim();
  const m = part?.municipio?.trim();
  if (u && m) return `${u} — ${m}`;
  if (u) return u;
  if (m) return m;
  return "—";
}

function localidadeFromEnder(ender: Record<string, unknown>): NfeLocalidade {
  const uf = String(ender.UF ?? ender.uf ?? "").trim();
  const municipio = String(ender.xMun ?? ender.xmun ?? "").trim();
  const cMun = String(ender.cMun ?? ender.cmun ?? "").trim();
  const out: NfeLocalidade = {};
  if (uf) out.uf = uf;
  if (municipio) out.municipio = municipio;
  if (cMun) out.cMun = cMun;
  return out;
}

/** Soma valores em nós cujo nome é vIBS ou vCBS (NF-e reforma — grupo IBSCBS no item) */
function sumDeepIbsCbs(imposto: unknown, keyLower: "vibs" | "vcbs"): number {
  let sum = 0;
  const walk = (node: unknown) => {
    if (node == null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k.toLowerCase() === keyLower) {
        sum += parseNumber(v);
      } else {
        walk(v);
      }
    }
  };
  walk(imposto);
  return sum;
}

/** Verifica se um objeto parece ser o bloco dest da NFe (tem CNPJ/CPF/xNome). */
function looksLikeDest(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const o = obj as Record<string, unknown>;
  return !!(
    o.CNPJ != null ||
    o.cnpj != null ||
    o.CPF != null ||
    o.cpf != null ||
    (o.xNome != null && typeof o.xNome === "string") ||
    (o.xnome != null && typeof o.xnome === "string") ||
    (o.nome != null && typeof o.nome === "string")
  );
}

/** Busca recursiva por objeto dest na árvore parseada. */
function findDestInTree(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 8) return null;
  if (looksLikeDest(node)) return node as Record<string, unknown>;
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  for (const v of Object.values(obj)) {
    const found = findDestInTree(v, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Extrai o bloco dest (destinatário) do XML. Tenta múltiplos caminhos e fallback via regex. */
function extractDestinatario(
  nfe: Record<string, unknown>,
  rawXml: string,
  fullData?: unknown
): Record<string, unknown> {
  const destKeys = ["dest", "Dest", "destinatario", "Destinatario", "DEST"];
  for (const key of destKeys) {
    const d = nfe[key];
    if (looksLikeDest(d)) return d as Record<string, unknown>;
  }

  const found = fullData ? findDestInTree(fullData) : null;
  if (found) return found;

  const destMatch =
    rawXml.match(/<dest[\s>]([\s\S]*?)<\/dest>/i) || rawXml.match(/<[\w-]+:dest[\s>]([\s\S]*?)<\/[\w-]+:dest>/i);
  if (destMatch) {
    const block = destMatch[1] ?? "";
    const cnpj = block.match(/<CNPJ[^>]*>([^<]*)<\/CNPJ>/i)?.[1]?.trim();
    const cpf = block.match(/<CPF[^>]*>([^<]*)<\/CPF>/i)?.[1]?.trim();
    const xnome = block.match(/<xNome[^>]*>([^<]*)<\/xNome>/i)?.[1]?.trim();
    const nome = block.match(/<nome[^>]*>([^<]*)<\/nome>/i)?.[1]?.trim();
    if (cnpj || cpf || xnome || nome) {
      return {
        CNPJ: cnpj ?? "",
        CPF: cpf ?? "",
        xNome: xnome ?? nome ?? "",
        nome: nome ?? xnome ?? "",
      };
    }
  }

  return {};
}

export const parseNfeXml = (xml: string): NfeRecord | null => {
  const data = parser.parse(xml);
  const nfeProc = data?.nfeProc;
  const nfeRoot = nfeProc?.NFe ?? data?.NFe ?? data?.nfe;
  const nfe = nfeRoot?.infNFe ?? nfeRoot?.infnfe ?? nfeRoot?.infNFeSupl;
  if (!nfe) return null;

  const ide = nfe.ide ?? {};
  const total = nfe.total?.ICMSTot ?? {};
  const det = toArray(nfe.det);

  const prot = nfeProc?.protNFe?.infProt ?? {};
  const evento = nfeProc?.procEventoNFe?.evento?.infEvento?.detEvento ?? {};
  const cancelada =
    String(prot?.cStat ?? "") !== "100" ||
    String(evento?.descEvento ?? "").toLowerCase().includes("cancelamento");

  const itens: NfeItem[] = det.map((item) => {
    const prod = item?.prod ?? {};
    const imposto = item?.imposto ?? {};
    const icmsGroup = imposto?.ICMS ?? {};
    const pisGroup = imposto?.PIS ?? {};
    const cofinsGroup = imposto?.COFINS ?? {};
    const ipiGroup = imposto?.IPI ?? {};

    // ICMS: pode estar em ICMS00, ICMS10, ICMS20, ICMS40, ICMS51, ICMS60, ICMS90, ICMSSN101, ICMSSN102, ICMSSN500, etc.
    const icmsKeys = Object.keys(icmsGroup).filter((k) => k.startsWith("ICMS"));
    const icms = icmsKeys.length > 0 ? icmsGroup[icmsKeys[0]] ?? {} : {};
    const orig = icms.orig ?? icms.ORIG ?? "";
    const cst = icms.CST ?? icms.CSOSN ?? icms.cst ?? icms.csosn ?? "";

    // PIS: PISAliq, PISOutr, PISNT, PISQtde
    const pisKeys = Object.keys(pisGroup).filter((k) => k.startsWith("PIS"));
    const pis = pisKeys.length > 0 ? pisGroup[pisKeys[0]] ?? {} : {};

    // COFINS: COFINSAliq, COFINSOutr, COFINSNT, COFINSQtde
    const cofinsKeys = Object.keys(cofinsGroup).filter((k) => k.startsWith("COFINS"));
    const cofins = cofinsKeys.length > 0 ? cofinsGroup[cofinsKeys[0]] ?? {} : {};

    // IPI: pode estar em IPITrib, IPI_TRIB, etc.
    const ipiKeys = Object.keys(ipiGroup);
    const ipiTribKey =
      ipiKeys.find((k) => k.toLowerCase().includes("ipitrib")) ??
      ipiKeys.find((k) => k.toLowerCase().startsWith("ipi"));
    const ipiTrib = ipiTribKey ? ipiGroup[ipiTribKey] ?? {} : {};

    const vIBS = sumDeepIbsCbs(imposto, "vibs");
    const vCBS = sumDeepIbsCbs(imposto, "vcbs");

    const cfopRaw = prod.CFOP ?? prod.cfop;
    const cfop = Array.isArray(cfopRaw) ? cfopRaw[0] : cfopRaw;

    return {
      productId: String(prod?.cProd ?? ""),
      description: String(prod?.xProd ?? "Item"),
      cest: String(prod?.CEST ?? prod?.cest ?? ""),
      quantity: parseNumber(prod?.qCom ?? prod?.qcom ?? 0),
      ncm: String(prod?.NCM ?? prod?.ncm ?? "").trim() || undefined,
      cfop: cfop ? String(cfop) : undefined,
      uCom: String(prod?.uCom ?? prod?.ucom ?? "").trim() || undefined,
      vUnCom: parseNumber(prod?.vUnCom ?? prod?.vUnTrib ?? 0),
      vProd: parseNumber(prod?.vProd ?? 0),
      orig: String(orig).trim() || undefined,
      cst: String(cst).trim() || undefined,
      modBC: String(icms?.modBC ?? icms?.ModBC ?? icms?.modBc ?? "").trim() || undefined,
      vBC: parseNumber(icms?.vBC ?? icms?.VBC ?? 0),
      pICMS: parseNumber(icms?.pICMS ?? icms?.pIcms ?? icms?.PICMS ?? 0),
      vICMS: parseNumber(icms?.vICMS ?? icms?.vIcms ?? icms?.VICMS ?? 0),
      cstPis: String(pis?.CST ?? pis?.cst ?? "").trim() || undefined,
      vBCPis: parseNumber(pis?.vBC ?? pis?.VBC ?? 0),
      pPIS: parseNumber(pis?.pPIS ?? pis?.pPis ?? pis?.PPIS ?? 0),
      vPIS: parseNumber(pis?.vPIS ?? pis?.vPis ?? pis?.VPIS ?? 0),
      cstCofins: String(cofins?.CST ?? cofins?.cst ?? "").trim() || undefined,
      vBCCofins: parseNumber(cofins?.vBC ?? cofins?.VBC ?? 0),
      pCOFINS: parseNumber(cofins?.pCOFINS ?? cofins?.pCofins ?? cofins?.PCOFINS ?? 0),
      vCOFINS: parseNumber(cofins?.vCOFINS ?? cofins?.vCofins ?? cofins?.VCOFINS ?? 0),
      cstIpi: String(ipiTrib?.CST ?? ipiTrib?.cst ?? "").trim() || undefined,
      vIBS,
      vCBS,
    };
  });

  const rawId = nfe?.Id ?? nfe?.["@_Id"] ?? "";

  const emit = nfe.emit ?? nfe.Emit ?? {};
  const ender = emit.enderEmit ?? emit.ender ?? emit.EnderEmit ?? emit.Ender ?? {};
  const enderecoParts = [
    [ender.xLgr, ender.nro, ender.xCpl].filter(Boolean).join(" "),
    ender.xBairro,
    [ender.xMun, ender.UF].filter(Boolean).join(ender.xMun && ender.UF ? "/" : ""),
    ender.CEP ? `CEP. ${String(ender.CEP).replace(/^(\d{5})(\d{3})$/, "$1-$2")}` : "",
  ].filter(Boolean);
  const endereco = enderecoParts.join(", ") || undefined;

  const dest = extractDestinatario(nfe, xml, data);
  const enderDest = (dest.enderDest ?? dest.ender ?? {}) as Record<string, unknown>;
  const enderecoDestParts = [
    [enderDest.xLgr, enderDest.nro, enderDest.xCpl].filter(Boolean).join(" "),
    enderDest.xBairro,
    [enderDest.xMun, enderDest.UF].filter(Boolean).join(enderDest.xMun && enderDest.UF ? "/" : ""),
    enderDest.CEP ? `CEP. ${String(enderDest.CEP).replace(/^(\d{5})(\d{3})$/, "$1-$2")}` : "",
  ].filter(Boolean);
  const enderecoDest = enderecoDestParts.join(", ") || undefined;

  const pick = (o: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) {
      const v = o[k];
      if (v != null && v !== "") {
        if (typeof v === "string") return v.trim();
        if (typeof v === "number") return String(v);
        if (typeof v === "object" && v !== null) {
          const textVal = (v as Record<string, unknown>)["#text"];
          if (textVal != null) return String(textVal).trim();
        }
      }
    }
    return "";
  };
  const destDoc = pick(dest, "CNPJ", "cnpj", "CPF", "cpf", "idEstrangeiro").trim();
  const destNome = pick(dest, "xNome", "xnome", "nome", "xLgr").trim();

  const locEmit = localidadeFromEnder(ender as Record<string, unknown>);
  const locDest = localidadeFromEnder(enderDest as Record<string, unknown>);

  return {
    chave: String(rawId).replace(/^NFe/, "") || String(prot?.chNFe ?? ""),
    numero: String(ide?.nNF ?? ""),
    serie: String(ide?.serie ?? ""),
    dataEmissao: String(ide?.dhEmi ?? ide?.dEmi ?? ""),
    valorTotal: parseNumber(total?.vNF ?? 0),
    status: cancelada ? "Cancelada" : "Autorizada",
    emitente: {
      cnpj: pick(emit as Record<string, unknown>, "CNPJ", "cnpj") || String(emit?.CNPJ ?? ""),
      razaoSocial: pick(emit as Record<string, unknown>, "xNome", "xnome") || String(emit?.xNome ?? ""),
      endereco,
      ...locEmit,
    },
    destinatario: destDoc || destNome
      ? {
          cnpj: destDoc || "—",
          razaoSocial: destNome || "Consumidor não identificado",
          endereco: enderecoDest || undefined,
          ...locDest,
        }
      : undefined,
    itens,
  };
};

export const summarizeItems = (itens: NfeItem[], limit = 2) => {
  if (!itens.length) return "Sem itens";
  const total = itens.reduce((acc, item) => acc + item.quantity, 0);
  const names = itens
    .slice(0, limit)
    .map((item) => item.description)
    .join("; ");
  const suffix = itens.length > limit ? "..." : "";
  return `${total} itens (${names}${suffix})`;
};

export const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatDate = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
};

export const formatCnpj = (cnpj: string | null) => {
  if (!cnpj) return "—";
  const s = cnpj.replace(/\D/g, "");
  if (s.length !== 14) return cnpj;
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const getMonthLabel = (records: { dataEmissao: string }[]) => {
  if (!records.length) return "";
  const dates = records.map((r) => new Date(r.dataEmissao)).filter((d) => !Number.isNaN(d.getTime()));
  if (!dates.length) return "";
  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  const sameMonth = min.getFullYear() === max.getFullYear() && min.getMonth() === max.getMonth();
  if (sameMonth) return `${MESES[min.getMonth()]} de ${min.getFullYear()}`;
  return `${MESES[min.getMonth()]} a ${MESES[max.getMonth()]} de ${max.getFullYear()}`;
};
