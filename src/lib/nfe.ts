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
};

export type NfeRecord = {
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  valorTotal: number;
  status: "Autorizada" | "Cancelada";
  cnpjMismatch?: boolean;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    endereco?: string;
  };
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

export const parseNfeXml = (xml: string): NfeRecord | null => {
  const data = parser.parse(xml);
  const nfeProc = data?.nfeProc;
  const nfeRoot = nfeProc?.NFe ?? data?.NFe ?? data?.nfe;
  const nfe = nfeRoot?.infNFe ?? nfeRoot?.infNFeSupl;
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
    };
  });

  const rawId = nfe?.Id ?? nfe?.["@_Id"] ?? "";

  const emit = nfe.emit ?? {};
  const ender = emit.enderEmit ?? emit.ender ?? {};
  const enderecoParts = [
    [ender.xLgr, ender.nro, ender.xCpl].filter(Boolean).join(" "),
    ender.xBairro,
    [ender.xMun, ender.UF].filter(Boolean).join(ender.xMun && ender.UF ? "/" : ""),
    ender.CEP ? `CEP. ${String(ender.CEP).replace(/^(\d{5})(\d{3})$/, "$1-$2")}` : "",
  ].filter(Boolean);
  const endereco = enderecoParts.join(", ") || undefined;

  return {
    chave: String(rawId).replace(/^NFe/, "") || String(prot?.chNFe ?? ""),
    numero: String(ide?.nNF ?? ""),
    serie: String(ide?.serie ?? ""),
    dataEmissao: String(ide?.dhEmi ?? ide?.dEmi ?? ""),
    valorTotal: parseNumber(total?.vNF ?? 0),
    status: cancelada ? "Cancelada" : "Autorizada",
    emitente: {
      cnpj: String(emit?.CNPJ ?? ""),
      razaoSocial: String(emit?.xNome ?? ""),
      endereco,
    },
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
