import type { NfeItem, NfeRecord } from "@/lib/nfe";
import type { TaxRuleContext } from "@/lib/tax-rule-context";
import { findConfazRowsForNcm, normalizeCestDigits, parseEmitDate } from "@/lib/confaz-st-lookup";

export type FiscalAlertLevel = "info" | "warning" | "error";

export type FiscalAlert = {
  tipo: string;
  descricao: string;
  nivel: FiscalAlertLevel;
  chave: string;
  itemIndex?: number;
  productId?: string;
  ruleCode?: string;
  legalSource?: string;
  detalhes?: Record<string, unknown>;
};

// Lista interna quando não há linha na tabela Confaz (mesma base legal — expandir via seed)
const NCM_EXIGE_CEST = [
  "22011000", "22021000", "22029000",
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
  if (!ncm) return true;
  const digits = ncm.replace(/\D/g, "");
  return digits.length === 8;
}

function cfopValido(cfop: string | undefined): boolean {
  if (!cfop?.trim()) return true;
  const digits = String(cfop).replace(/\D/g, "");
  return digits.length === 4;
}

function scoreDefaultForLevel(nivel: FiscalAlertLevel): number {
  if (nivel === "error") return 10;
  if (nivel === "warning") return 3;
  return 1;
}

function applyRuleMeta(
  code: string | undefined,
  ctx: TaxRuleContext | undefined,
  nivel: FiscalAlertLevel,
  detalhes: Record<string, unknown> | undefined
): { nivel: FiscalAlertLevel; ruleCode?: string; legalSource?: string; detalhes?: Record<string, unknown> } {
  if (!code || !ctx?.taxRulesByCode.has(code)) {
    return {
      nivel,
      detalhes: { ...detalhes, scoreImpact: scoreDefaultForLevel(nivel) },
    };
  }
  const rule = ctx.taxRulesByCode.get(code)!;
  const sev = rule.defaultSeverity as FiscalAlertLevel;
  return {
    nivel: ["error", "warning", "info"].includes(sev) ? sev : nivel,
    ruleCode: code,
    legalSource: rule.legalSource ?? undefined,
    detalhes: { ...detalhes, scoreImpact: rule.weight },
  };
}

/**
 * Analisa uma nota fiscal com o motor de regras (ST/Confaz, SINIEF, consistência ICMS/PIS).
 * Passe `taxCtx` quando disponível (carregado do banco: TaxRule + ConfazStItem).
 */
export function analyzeFiscal(
  record: NfeRecord,
  client: { cnpj?: string | null; uf?: string | null },
  taxCtx?: TaxRuleContext
): FiscalAlert[] {
  const alerts: FiscalAlert[] = [];
  const emitDate = parseEmitDate(record.dataEmissao) ?? new Date();

  record.itens.forEach((item: NfeItem, itemIndex: number) => {
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
        const meta = applyRuleMeta("SINIEF_ICMS_CALC", taxCtx, "warning", {
          vBC: item.vBC,
          pICMS: item.pICMS,
          vICMS: item.vICMS,
          esperado,
        });
        alerts.push({
          tipo: "divergencia_icms",
          descricao: `Divergência de ICMS: esperado ${esperado.toFixed(2)}, informado ${item.vICMS.toFixed(2)}`,
          nivel: meta.nivel,
          chave: record.chave,
          itemIndex,
          productId: item.productId,
          ruleCode: meta.ruleCode,
          legalSource: meta.legalSource,
          detalhes: meta.detalhes,
        });
      }
    }

    if (item.ncm && !ncmValido(item.ncm)) {
      const meta = applyRuleMeta("COTEPE_NCM_FORMAT", taxCtx, "warning", { ncm: item.ncm });
      alerts.push({
        tipo: "ncm_invalido",
        descricao: `NCM inválido: deve ter 8 dígitos (informado: ${item.ncm})`,
        nivel: meta.nivel,
        chave: record.chave,
        itemIndex,
        productId: item.productId,
        ruleCode: meta.ruleCode,
        legalSource: meta.legalSource,
        detalhes: meta.detalhes,
      });
    }

    const confazRows = taxCtx
      ? findConfazRowsForNcm(item.ncm, taxCtx.confazStItems, emitDate)
      : [];
    if (confazRows.length > 0) {
      const acceptable = new Set(confazRows.map((r) => normalizeCestDigits(r.cest)));
      const legalRef = confazRows[0]!.legalSource;
      const suggestion = confazRows.map((r) => r.cest).filter(Boolean).join(" ou ");
      if (!item.cest?.trim()) {
        const meta = applyRuleMeta("CONF_142_CEST_REQUIRED", taxCtx, "warning", {
          ncm: item.ncm,
          suggestion,
        });
        alerts.push({
          tipo: "cest_obrigatorio",
          descricao: `NCM ${item.ncm} sujeito à ST (${legalRef}): CEST obrigatório não informado`,
          nivel: meta.nivel,
          chave: record.chave,
          itemIndex,
          productId: item.productId,
          ruleCode: meta.ruleCode ?? "CONF_142_CEST_REQUIRED",
          legalSource: meta.legalSource ?? legalRef,
          detalhes: { ...meta.detalhes, ncm: item.ncm, suggestion },
        });
      } else {
        const got = normalizeCestDigits(item.cest);
        if (!acceptable.has(got)) {
          const meta = applyRuleMeta("CONF_142_CEST_MISMATCH", taxCtx, "warning", {
            ncm: item.ncm,
            cestInformado: item.cest,
            suggestion,
          });
          alerts.push({
            tipo: "cest_incompativel",
            descricao: `CEST ${item.cest?.trim()} não corresponde ao NCM ${item.ncm} (${legalRef})`,
            nivel: meta.nivel,
            chave: record.chave,
            itemIndex,
            productId: item.productId,
            ruleCode: meta.ruleCode ?? "CONF_142_CEST_MISMATCH",
            legalSource: meta.legalSource ?? legalRef,
            detalhes: meta.detalhes,
          });
        }
      }
    } else if (item.ncm && ncmExigeCest(item.ncm) && !item.cest?.trim()) {
      const meta = applyRuleMeta("CONF_142_CEST_REQUIRED", taxCtx, "warning", { ncm: item.ncm });
      alerts.push({
        tipo: "cest_obrigatorio",
        descricao: `NCM ${item.ncm} exige CEST, mas o campo está vazio (regra ST — complemente a tabela Confaz no sistema)`,
        nivel: meta.nivel,
        chave: record.chave,
        itemIndex,
        productId: item.productId,
        ruleCode: taxCtx?.taxRulesByCode.has("CONF_142_CEST_REQUIRED") ? "CONF_142_CEST_REQUIRED" : undefined,
        legalSource: meta.legalSource,
        detalhes: meta.detalhes,
      });
    }

    const cst = item.cst ?? "";
    if (["60", "40", "41", "50"].includes(cst) && item.vICMS != null && item.vICMS > 0) {
      const meta = applyRuleMeta("SINIEF_CST_ICMS", taxCtx, "error", { cst, vICMS: item.vICMS });
      alerts.push({
        tipo: "cst_icms_incompativel",
        descricao: `CST ${cst} (isento/não tributado) não pode ter valor de ICMS`,
        nivel: meta.nivel,
        chave: record.chave,
        itemIndex,
        productId: item.productId,
        ruleCode: meta.ruleCode,
        legalSource: meta.legalSource,
        detalhes: meta.detalhes,
      });
    }

    if (
      isBebidaAlcoolica(item.ncm) &&
      item.vICMS != null &&
      item.vICMS === 0 &&
      item.vProd != null &&
      item.vProd > 0
    ) {
      const meta = applyRuleMeta("ICMS_ST_BEBIDA_ZERO", taxCtx, "warning", { ncm: item.ncm });
      alerts.push({
        tipo: "bebida_icms_zerado",
        descricao: `Produto com NCM de bebida alcoólica (${item.ncm}) apresentando ICMS zerado`,
        nivel: meta.nivel,
        chave: record.chave,
        itemIndex,
        productId: item.productId,
        ruleCode: meta.ruleCode,
        legalSource: meta.legalSource,
        detalhes: meta.detalhes,
      });
    }

    if (item.cfop?.trim() && !cfopValido(item.cfop)) {
      const meta = applyRuleMeta("SINIEF_CFOP_FORMAT", taxCtx, "warning", { cfop: item.cfop });
      alerts.push({
        tipo: "cfop_invalido",
        descricao: `CFOP inválido: deve ter 4 dígitos (informado: ${item.cfop})`,
        nivel: meta.nivel,
        chave: record.chave,
        itemIndex,
        productId: item.productId,
        ruleCode: meta.ruleCode,
        legalSource: meta.legalSource,
        detalhes: meta.detalhes,
      });
    }

    const notaTipo = (record.tipo ?? "outro") as string;
    if (item.cfop?.trim() && notaTipo === "venda") {
      const primeiroDigito = String(item.cfop).replace(/\D/g, "").slice(0, 1);
      const cfopEhEntrada = ["1", "2", "3"].includes(primeiroDigito);
      if (cfopEhEntrada) {
        const meta = applyRuleMeta("SINIEF_CFOP_OPERACAO", taxCtx, "error", { cfop: item.cfop, notaTipo });
        alerts.push({
          tipo: "cfop_incompativel",
          descricao: `CFOP ${item.cfop} é de entrada, incompatível com nota de venda (empresa é emitente)`,
          nivel: meta.nivel,
          chave: record.chave,
          itemIndex,
          productId: item.productId,
          ruleCode: meta.ruleCode,
          legalSource: meta.legalSource,
          detalhes: meta.detalhes,
        });
      }
    }

    const cstPis = item.cstPis ?? "";
    const cstCofins = item.cstCofins ?? "";
    const cstExigeTributacao = ["01", "02"].includes(cstPis) || ["01", "02"].includes(cstCofins);
    if (cstExigeTributacao && item.vProd != null && item.vProd > 0) {
      const pisZerado = (item.vPIS ?? 0) === 0 && ["01", "02"].includes(cstPis);
      const cofinsZerado = (item.vCOFINS ?? 0) === 0 && ["01", "02"].includes(cstCofins);
      if (pisZerado || cofinsZerado) {
        const msg: string[] = [];
        if (pisZerado) msg.push("PIS");
        if (cofinsZerado) msg.push("COFINS");
        const meta = applyRuleMeta("SINIEF_PIS_COFINS", taxCtx, "warning", { cstPis, cstCofins, vPIS: item.vPIS, vCOFINS: item.vCOFINS });
        alerts.push({
          tipo: "pis_cofins_zerado",
          descricao: `CST exige tributação, mas ${msg.join(" e ")} estão zerados`,
          nivel: meta.nivel,
          chave: record.chave,
          itemIndex,
          productId: item.productId,
          ruleCode: meta.ruleCode,
          legalSource: meta.legalSource,
          detalhes: meta.detalhes,
        });
      }
    }
  });

  return alerts;
}

export function calculateFiscalScore(alerts: FiscalAlert[]): number {
  let score = 100;
  for (const a of alerts) {
    const sp = a.detalhes && typeof a.detalhes.scoreImpact === "number" ? a.detalhes.scoreImpact : null;
    if (sp != null && sp > 0) {
      score -= sp;
    } else if (a.nivel === "error") score -= 10;
    else if (a.nivel === "warning") score -= 3;
    else if (a.nivel === "info") score -= 1;
  }
  return Math.max(0, Math.min(100, score));
}

/** Alertas persistidos (detalhes JSON) — mesmo critério de peso do motor */
export function scoreImpactFromStoredAlert(detalhes: string | null | undefined, nivel: string): number {
  if (detalhes) {
    try {
      const d = JSON.parse(detalhes) as { scoreImpact?: number };
      if (typeof d.scoreImpact === "number" && d.scoreImpact > 0) return d.scoreImpact;
    } catch {
      /* ignore */
    }
  }
  if (nivel === "error") return 10;
  if (nivel === "warning") return 3;
  return 1;
}

export function calculateFiscalScoreFromStored(
  alerts: { detalhes?: string | null | undefined; nivel: string }[]
): number {
  let score = 100;
  for (const a of alerts) {
    score -= scoreImpactFromStoredAlert(a.detalhes, a.nivel);
  }
  return Math.max(0, Math.min(100, score));
}
