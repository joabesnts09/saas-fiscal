/**
 * Motor de geração de parecer de auditoria fiscal automático.
 * Transforma inconsistências (findings) em linguagem de contador: conclusão + recomendações.
 */

import { calculateFiscalScoreFromStored } from "@/lib/fiscal-engine";

export type FiscalAlertLike = {
  tipo: string;
  nivel: string;
  detalhes?: string | null;
};

export type ParecerGerado = {
  conclusao: string;
  recomendacoes: string;
  statusSugerido: "em_analise" | "concluida" | "revisada";
  nivelRiscoSugerido: "baixo" | "medio" | "alto";
};

// Labels amigáveis por tipo de inconsistência
const TIPO_MENSAGEM: Record<string, { frase: string; recomendacao: string }> = {
  ncm_invalido: {
    frase: "itens com NCM inválido (deve conter 8 dígitos)",
    recomendacao: "Revisar a classificação fiscal (NCM) dos produtos para garantir 8 dígitos",
  },
  cest_obrigatorio: {
    frase: "itens sem CEST informado (obrigatório para NCMs sujeitos à ST)",
    recomendacao: "Preencher o CEST nos produtos sujeitos à substituição tributária",
  },
  cest_incompativel: {
    frase: "itens com CEST incompatível com o NCM (Convênio ICMS 142/18 / ST)",
    recomendacao: "Corrigir o CEST conforme a tabela do Convênio ICMS 142/18 para o NCM informado",
  },
  cfop_invalido: {
    frase: "itens com CFOP inválido (deve conter 4 dígitos)",
    recomendacao: "Corrigir a estrutura dos CFOPs para 4 dígitos conforme tabela oficial",
  },
  cfop_incompativel: {
    frase: "itens com CFOP incompatível com o tipo de operação (entrada/saída)",
    recomendacao: "Validar os CFOPs utilizados conforme a natureza da operação (entrada ou saída)",
  },
  cst_icms_incompativel: {
    frase: "itens com CST de ICMS incompatível (isento/não tributado com valor informado)",
    recomendacao: "Verificar a combinação CST x valor de ICMS nos itens",
  },
  bebida_icms_zerado: {
    frase: "itens de bebida alcoólica com ICMS zerado",
    recomendacao: "Revisar a tributação de bebidas alcoólicas (ICMS deve ser informado quando aplicável)",
  },
  pis_cofins_zerado: {
    frase: "itens com PIS/COFINS zerado apesar de CST que exige tributação",
    recomendacao: "Validar PIS e COFINS nos itens com CST 01/02",
  },
  divergencia_icms: {
    frase: "itens com divergência entre base de cálculo, alíquota e valor de ICMS",
    recomendacao: "Revisar o cálculo do ICMS (base x alíquota vs valor informado)",
  },
};

function getMensagemPorTipo(tipo: string) {
  return TIPO_MENSAGEM[tipo] ?? { frase: `itens com inconsistência (${tipo})`, recomendacao: `Revisar a inconsistência: ${tipo}` };
}

/**
 * Agrega alertas por tipo, retornando contagem por código.
 */
export function aggregateFindingsByTipo(alerts: FiscalAlertLike[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const a of alerts) {
    const t = a.tipo?.trim() || "outro";
    summary[t] = (summary[t] ?? 0) + 1;
  }
  return summary;
}

/**
 * Calcula o score fiscal (0–100) a partir dos alertas.
 */
export function calculateParecerScore(alerts: FiscalAlertLike[]): number {
  return calculateFiscalScoreFromStored(alerts);
}

/**
 * Define nível de risco com base no score.
 */
export function getNivelRiscoFromScore(score: number): "baixo" | "medio" | "alto" {
  if (score >= 90) return "baixo";
  if (score >= 70) return "medio";
  return "alto";
}

/**
 * Sugere status da auditoria com base em erros e score.
 */
export function getStatusSugerido(erros: number, avisos: number, score: number): "em_analise" | "concluida" | "revisada" {
  if (erros > 0 || score < 70) return "em_analise";
  if (avisos > 0 || score < 90) return "concluida";
  return "revisada";
}

/**
 * Gera o texto da conclusão em linguagem de contador.
 */
export function generateConclusion(
  summaryByTipo: Record<string, number>,
  score: number,
  notasAnalisadas: number,
  erros: number,
  avisos: number
): string {
  const totalIssues = Object.values(summaryByTipo).reduce((a, b) => a + b, 0);

  let text = "";

  if (totalIssues === 0) {
    text +=
      "A análise das notas fiscais do período indica excelente conformidade fiscal. Nenhuma inconsistência foi detectada nas classificações tributárias, CFOP, NCM, CST e demais campos analisados. ";
  } else if (erros > 0) {
    text +=
      "Foram identificadas inconsistências relevantes que requerem atenção e correção. ";
  } else if (totalIssues <= 5) {
    text +=
      "A análise indica boa conformidade fiscal, com inconsistências pontuais que merecem revisão preventiva. ";
  } else {
    text +=
      "Foram identificadas inconsistências que exigem atenção para garantir a conformidade fiscal. ";
  }

  // Detalhamento por tipo (ordem de prioridade)
  const tiposOrdem = [
    "ncm_invalido",
    "cest_obrigatorio",
    "cest_incompativel",
    "cfop_invalido",
    "cfop_incompativel",
    "cst_icms_incompativel",
    "bebida_icms_zerado",
    "pis_cofins_zerado",
    "divergencia_icms",
  ];

  const partes: string[] = [];
  for (const tipo of tiposOrdem) {
    const count = summaryByTipo[tipo];
    if (count && count > 0) {
      const { frase } = getMensagemPorTipo(tipo);
      partes.push(`${count} ${frase}`);
    }
  }

  // Tipos não mapeados
  for (const [tipo, count] of Object.entries(summaryByTipo)) {
    if (count > 0 && !tiposOrdem.includes(tipo)) {
      const { frase } = getMensagemPorTipo(tipo);
      partes.push(`${count} ${frase}`);
    }
  }

  if (partes.length > 0) {
    text += partes.join(". ") + ". ";
  }

  text += `Foram analisadas ${notasAnalisadas} nota(s), com score fiscal de ${score}/100 (${erros} erro(s) e ${avisos} aviso(s)).`;

  return text.trim();
}

/**
 * Gera as recomendações em formato de lista (cada item em uma linha com bullet).
 */
export function generateRecommendations(summaryByTipo: Record<string, number>): string {
  const tiposOrdem = [
    "ncm_invalido",
    "cest_obrigatorio",
    "cest_incompativel",
    "cfop_invalido",
    "cfop_incompativel",
    "cst_icms_incompativel",
    "bebida_icms_zerado",
    "pis_cofins_zerado",
    "divergencia_icms",
  ];

  const recs: string[] = [];
  const added = new Set<string>();

  for (const tipo of tiposOrdem) {
    if (summaryByTipo[tipo] && summaryByTipo[tipo] > 0) {
      const { recomendacao } = getMensagemPorTipo(tipo);
      if (!added.has(recomendacao)) {
        added.add(recomendacao);
        recs.push(recomendacao);
      }
    }
  }

  for (const [tipo] of Object.entries(summaryByTipo)) {
    if (summaryByTipo[tipo] > 0 && !tiposOrdem.includes(tipo)) {
      const { recomendacao } = getMensagemPorTipo(tipo);
      if (!added.has(recomendacao)) {
        added.add(recomendacao);
        recs.push(recomendacao);
      }
    }
  }

  if (recs.length === 0) {
    return "Manter o padrão de preenchimento e revisão periódica das notas fiscais.";
  }

  return recs.map((r) => `• ${r}`).join("\n");
}

/**
 * Pipeline completo: gera parecer automático a partir dos alertas.
 */
export function generateParecerAutomatico(
  alerts: FiscalAlertLike[],
  notasAnalisadas: number
): ParecerGerado {
  const summaryByTipo = aggregateFindingsByTipo(alerts);
  const score = calculateParecerScore(alerts);
  const erros = alerts.filter((a) => a.nivel === "error").length;
  const avisos = alerts.filter((a) => a.nivel === "warning").length;

  return {
    conclusao: generateConclusion(summaryByTipo, score, notasAnalisadas, erros, avisos),
    recomendacoes: generateRecommendations(summaryByTipo),
    statusSugerido: getStatusSugerido(erros, avisos, score),
    nivelRiscoSugerido: getNivelRiscoFromScore(score),
  };
}
