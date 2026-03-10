import type { NfeItem, NfeRecord } from "@/lib/nfe";

export type FiscalAlertLevel = "info" | "warning" | "error";

export type FiscalAlert = {
  tipo: string;
  descricao: string;
  nivel: FiscalAlertLevel;
  chave: string;
  itemIndex?: number;
  productId?: string;
  detalhes?: Record<string, unknown>;
};

// NCMs que exigem CEST (exemplos - lista parcial da legislação)
const NCM_EXIGE_CEST = [
  "22011000", "22021000", "22029000", // bebidas
  "22030000", "22041000", "22042100", "22042200", "22042900", "22043000",
  "22060010", "22060090", "22071000", "22072010", "22072090", "22073000",
  "22084000", "22085000", "22086000", "22087000", "22089000", "22090000",
  "21011000", "21012000", "21013000", "21039010", "21039090", "21069010",
  "19053100", "19053200", "19059000", "20079900", "20081900", "20082000",
  "20083000", "20084000", "20089100", "20089200", "20089900",
  "04011010", "04011020", "04012010", "04012020", "04014010", "04014020",
  "04015010", "04015020", "04021010", "04021020", "04022110", "04022120",
  "04022910", "04022920", "04029110", "04029120", "04029910", "04029920",
  "04031010", "04031020", "04039010", "04039020", "04041000", "04049000",
  "04051000", "04052000", "04059000", "04061000", "04062000", "04063000",
  "04064000", "04069000", "04070000", "04081100", "04081900", "04089100",
  "04089900", "04011000", "04012000", "04014000", "04015000", "04021000",
  "04022100", "04022900", "04029100", "04029900", "04031000", "04039000",
];

// NCMs de bebidas alcoólicas (devem ter ICMS > 0 em operações normais, exceto isenções legais)
const NCM_BEBIDA_ALCOOLICA_PREFIX = ["2203", "2204", "2205", "2206", "2207", "2208"];

function ncmExigeCest(ncm: string | undefined): boolean {
  if (!ncm) return false;
  const digits = ncm.replace(/\D/g, "");
  if (digits.length < 4) return false;
  return NCM_EXIGE_CEST.some((code) => digits.startsWith(code.replace(/\D/g, "")));
}

function isBebidaAlcoolica(ncm: string | undefined): boolean {
  if (!ncm) return false;
  const digits = ncm.replace(/\D/g, "");
  return NCM_BEBIDA_ALCOOLICA_PREFIX.some((p) => digits.startsWith(p));
}

function ncmValido(ncm: string | undefined): boolean {
  if (!ncm) return true; // vazio pode ser opcional em alguns casos
  const digits = ncm.replace(/\D/g, "");
  return digits.length === 8;
}

export function analyzeFiscal(
  record: NfeRecord,
  client: { cnpj?: string | null; uf?: string | null }
): FiscalAlert[] {
  const alerts: FiscalAlert[] = [];
  const emitenteUf = (record.emitente as { uf?: string })?.uf ?? "";

  record.itens.forEach((item: NfeItem, itemIndex: number) => {
    // 1. Divergência de ICMS: vBC * (pICMS/100) ≈ vICMS (tolerância 0.01)
    if (
      item.vBC != null &&
      item.vBC > 0 &&
      item.pICMS != null &&
      item.pICMS > 0 &&
      item.vICMS != null
    ) {
      const esperado = (item.vBC * item.pICMS) / 100;
      const diff = Math.abs(esperado - item.vICMS);
      if (diff > 0.02) {
        alerts.push({
          tipo: "divergencia_icms",
          descricao: `Divergência de ICMS: esperado ${esperado.toFixed(2)}, informado ${item.vICMS.toFixed(2)}`,
          nivel: "warning",
          chave: record.chave,
          itemIndex,
          productId: item.productId,
          detalhes: { vBC: item.vBC, pICMS: item.pICMS, vICMS: item.vICMS, esperado },
        });
      }
    }

    // 2. NCM inválido (deve ter 8 dígitos)
    if (item.ncm && !ncmValido(item.ncm)) {
      alerts.push({
        tipo: "ncm_invalido",
        descricao: `NCM inválido: deve ter 8 dígitos (informado: ${item.ncm})`,
        nivel: "warning",
        chave: record.chave,
        itemIndex,
        productId: item.productId,
        detalhes: { ncm: item.ncm },
      });
    }

    // 3. CEST obrigatório não informado
    if (item.ncm && ncmExigeCest(item.ncm) && !item.cest?.trim()) {
      alerts.push({
        tipo: "cest_obrigatorio",
        descricao: `NCM ${item.ncm} exige CEST, mas o campo está vazio`,
        nivel: "warning",
        chave: record.chave,
        itemIndex,
        productId: item.productId,
        detalhes: { ncm: item.ncm },
      });
    }

    // 4. CST 060/40 com ICMS (não pode ter ICMS)
    const cst = item.cst ?? "";
    if (["60", "40", "41", "50"].includes(cst) && item.vICMS != null && item.vICMS > 0) {
      alerts.push({
        tipo: "cst_icms_incompativel",
        descricao: `CST ${cst} (isento/não tributado) não pode ter valor de ICMS`,
        nivel: "error",
        chave: record.chave,
        itemIndex,
        productId: item.productId,
        detalhes: { cst, vICMS: item.vICMS },
      });
    }

    // 5. Bebida alcoólica com ICMS zerado (possível erro/fraude)
    if (
      isBebidaAlcoolica(item.ncm) &&
      item.vICMS != null &&
      item.vICMS === 0 &&
      item.vProd != null &&
      item.vProd > 0
    ) {
      alerts.push({
        tipo: "bebida_icms_zerado",
        descricao: `Produto com NCM de bebida alcoólica (${item.ncm}) apresentando ICMS zerado`,
        nivel: "warning",
        chave: record.chave,
        itemIndex,
        productId: item.productId,
        detalhes: { ncm: item.ncm },
      });
    }

    // 6. CFOP incorreto (simplificado: 5102 = interno, 6102 = interestadual)
    // Sem UF do destinatário, não podemos validar com precisão - pular por enquanto
  });

  return alerts;
}

export function calculateFiscalScore(alerts: FiscalAlert[]): number {
  let score = 100;
  for (const a of alerts) {
    if (a.nivel === "error") score -= 10;
    else if (a.nivel === "warning") score -= 3;
    else if (a.nivel === "info") score -= 1;
  }
  return Math.max(0, Math.min(100, score));
}
