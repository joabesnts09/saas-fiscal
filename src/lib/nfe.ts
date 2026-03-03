import { XMLParser } from "fast-xml-parser";

export type NfeItem = {
  productId: string;
  description: string;
  cest: string;
  quantity: number;
};

export type NfeRecord = {
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  valorTotal: number;
  status: "Autorizada" | "Cancelada";
  emitente: {
    cnpj: string;
    razaoSocial: string;
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
    return {
      productId: String(prod?.cProd ?? ""),
      description: String(prod?.xProd ?? "Item"),
      cest: String(prod?.CEST ?? ""),
      quantity: parseNumber(prod?.qCom ?? 0),
    };
  });

  const rawId = nfe?.Id ?? nfe?.["@_Id"] ?? "";

  const emit = nfe.emit ?? {};

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
