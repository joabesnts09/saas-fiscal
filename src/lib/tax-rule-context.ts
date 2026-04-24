import type { PrismaClient, TaxRule, ConfazStItem } from "@prisma/client";

export type TaxRuleContext = {
  confazStItems: ConfazStItem[];
  taxRulesByCode: Map<string, TaxRule>;
};

let cache: { at: number; data: TaxRuleContext } | null = null;
const CACHE_MS = 60_000;

/**
 * Carrega regras cadastradas e tabela Confaz ST (Convênio 142/18) para o motor fiscal.
 * Cache leve em memória para não consultar o banco em cada item de nota no mesmo request.
 */
export async function loadTaxRuleContext(prisma: PrismaClient): Promise<TaxRuleContext> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return cache.data;
  }
  const [rules, confazStItems] = await Promise.all([
    prisma.taxRule.findMany({ where: { active: true } }),
    prisma.confazStItem.findMany(),
  ]);
  const taxRulesByCode = new Map(rules.map((r) => [r.code, r]));
  const data: TaxRuleContext = { confazStItems, taxRulesByCode };
  cache = { at: now, data };
  return data;
}

export function invalidateTaxRuleContextCache(): void {
  cache = null;
}
