import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5454/fiscal_flow";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/** Motor fiscal: regras versionáveis + amostra ST/CEST (Convênio 142/18) — expandir via importação */
async function seedTaxRuleEngine(db: PrismaClient) {
  const vigIni = new Date("2018-01-01T00:00:00.000Z");

  const taxRules: Array<{
    code: string;
    name: string;
    description: string;
    category: string;
    legalSource: string | null;
    defaultSeverity: string;
    weight: number;
    active: boolean;
    priority: number;
  }> = [
    {
      code: "CONF_142_CEST_REQUIRED",
      name: "CEST obrigatório (substituição tributária)",
      description: "Produto listado no Anexo do Convênio ICMS 142/18 sem CEST informado.",
      category: "ST",
      legalSource: "Convênio ICMS 142/18",
      defaultSeverity: "warning",
      weight: 15,
      active: true,
      priority: 100,
    },
    {
      code: "CONF_142_CEST_MISMATCH",
      name: "CEST incompatível com NCM",
      description: "CEST informado não corresponde ao esperado para o NCM na tabela ST.",
      category: "ST",
      legalSource: "Convênio ICMS 142/18",
      defaultSeverity: "warning",
      weight: 12,
      active: true,
      priority: 99,
    },
    {
      code: "SINIEF_ICMS_CALC",
      name: "Cálculo de ICMS (base × alíquota)",
      description: "Divergência entre vBC, pICMS e vICMS no item.",
      category: "ICMS",
      legalSource: "Ajustes SINIEF / manual NF-e",
      defaultSeverity: "warning",
      weight: 8,
      active: true,
      priority: 80,
    },
    {
      code: "COTEPE_NCM_FORMAT",
      name: "Formato de NCM",
      description: "NCM deve conter 8 dígitos numéricos.",
      category: "ICMS",
      legalSource: "Atos COTEPE/ICMS — classificação fiscal",
      defaultSeverity: "warning",
      weight: 6,
      active: true,
      priority: 70,
    },
    {
      code: "SINIEF_CFOP_FORMAT",
      name: "Formato de CFOP",
      description: "CFOP com 4 dígitos.",
      category: "NFE",
      legalSource: "Ajustes SINIEF — NF-e",
      defaultSeverity: "warning",
      weight: 6,
      active: true,
      priority: 75,
    },
    {
      code: "SINIEF_CFOP_OPERACAO",
      name: "CFOP coerente com operação",
      description: "CFOP de entrada em operação de saída (perspectiva emitente).",
      category: "NFE",
      legalSource: "Ajustes SINIEF — NF-e",
      defaultSeverity: "error",
      weight: 12,
      active: true,
      priority: 90,
    },
    {
      code: "SINIEF_CST_ICMS",
      name: "CST ICMS × valor",
      description: "CST isento/não tributado com valor de ICMS informado.",
      category: "NFE",
      legalSource: "Ajustes SINIEF — NF-e",
      defaultSeverity: "error",
      weight: 14,
      active: true,
      priority: 92,
    },
    {
      code: "SINIEF_PIS_COFINS",
      name: "PIS/COFINS × CST",
      description: "CST exige tributação com PIS ou COFINS zerados.",
      category: "NFE",
      legalSource: "Ajustes SINIEF — NF-e",
      defaultSeverity: "warning",
      weight: 7,
      active: true,
      priority: 78,
    },
    {
      code: "ICMS_ST_BEBIDA_ZERO",
      name: "Bebida alcoólica com ICMS zerado",
      description: "Possível inconsistência em produto sujeito a ICMS.",
      category: "ICMS",
      legalSource: "Legislação ICMS / ST",
      defaultSeverity: "warning",
      weight: 8,
      active: true,
      priority: 60,
    },
    {
      code: "PROTOCOLO_ST_UF",
      name: "ST interestadual (reservado)",
      description: "Regras por UF — implementação futura (Protocolos ICMS).",
      category: "PROTOCOLO",
      legalSource: "Protocolos ICMS",
      defaultSeverity: "warning",
      weight: 10,
      active: false,
      priority: 0,
    },
    {
      code: "MVA_ST_BASE",
      name: "MVA / base ICMS ST (reservado)",
      description: "Validação de MVA e base de cálculo ST — implementação futura (Atos MVA).",
      category: "MVA",
      legalSource: "Atos MVA",
      defaultSeverity: "warning",
      weight: 10,
      active: false,
      priority: 0,
    },
  ];

  for (const r of taxRules) {
    await db.taxRule.upsert({
      where: { code: r.code },
      create: r,
      update: {
        name: r.name,
        description: r.description,
        category: r.category,
        legalSource: r.legalSource,
        defaultSeverity: r.defaultSeverity,
        weight: r.weight,
        active: r.active,
        priority: r.priority,
      },
    });
  }

  /**
   * Amostra + prefixos de capítulo para testes reais.
   * Produção: importar anexo integral do Convênio ICMS 142/18 (ou atualização vigente).
   * legalSource único permite deleteMany e re-seed idempotente.
   */
  const confazSeedTag = "Convênio ICMS 142/18 (seed)";
  await db.confazStItem.deleteMany({ where: { legalSource: confazSeedTag } });
  await db.confazStItem.createMany({
    data: [
      {
        ncmPattern: "22011000",
        cest: "0300100",
        descricao: "Águas minerais, incluindo as gaseificadas (exemplo seed)",
        segmento: "Bebidas",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      {
        ncmPattern: "22021000",
        cest: "0300200",
        descricao: "Águas, incluindo as minerais e as gaseificadas, adicionadas de açúcar (exemplo seed)",
        segmento: "Bebidas",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      {
        ncmPattern: "04011010",
        cest: "1700200",
        descricao: "Leite UHT (exemplo seed)",
        segmento: "Lácteos",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      // Capítulo 85 — materiais / partes elétricas (prefixo cobre 85359090, 85366990, etc.)
      {
        ncmPattern: "8535",
        cest: "1200300",
        descricao:
          "Partes de aparelhos e equipamentos elétricos — CEST típico cap. 85 (seed; conferir linha exata no anexo oficial)",
        segmento: "Materiais e partes elétricas",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      {
        ncmPattern: "8536",
        cest: "1200400",
        descricao: "Aparelhos para instalações elétricas (referência seed — validar no anexo)",
        segmento: "Instalações e aparelhos elétricos",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      {
        ncmPattern: "8537",
        cest: "1200500",
        descricao: "Quadros, painéis, consoles (referência seed — validar no anexo)",
        segmento: "Quadros e comandos elétricos",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      // Máquinas e equipamentos elétricos / solda (prefixo cobre 85153900, 85159000, etc.)
      {
        ncmPattern: "8515",
        cest: "1200100",
        descricao: "Máquinas e aparelhos para soldar elétrico ou a gás (referência seed)",
        segmento: "Soldagem e equipamentos correlatos",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      {
        ncmPattern: "8515",
        cest: "1200200",
        descricao: "Partes de máquinas de solda (referência seed — múltiplos CEST possíveis)",
        segmento: "Soldagem e equipamentos correlatos",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      {
        ncmPattern: "8516",
        cest: "1200600",
        descricao: "Aquecedores elétricos de água; chaleiras (referência seed)",
        segmento: "Eletrodomésticos / aquecimento",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      {
        ncmPattern: "8544",
        cest: "2100200",
        descricao: "Fios e cabos isolados para eletricidade (referência seed)",
        segmento: "Cabos e condutores",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      // Bebidas — prefixos amplos (seed didático)
      {
        ncmPattern: "2203",
        cest: "0300300",
        descricao: "Cervejas de malte (referência seed)",
        segmento: "Bebidas alcoólicas",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      {
        ncmPattern: "2204",
        cest: "0300400",
        descricao: "Vinhos e mostos (referência seed)",
        segmento: "Bebidas alcoólicas",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
      {
        ncmPattern: "2208",
        cest: "0300500",
        descricao: "Bebidas alcoólicas cap. 22.08 (referência seed)",
        segmento: "Bebidas alcoólicas",
        vigenteDesde: vigIni,
        vigenteAte: null,
        legalSource: confazSeedTag,
      },
    ],
  });

  console.log("Motor fiscal: TaxRule + ConfazStItem (amostra) atualizados.");
}

async function main() {
  // Superadmin: use variáveis de ambiente no deploy ou defaults em desenvolvimento
  const superadminEmail =
    (process.env.SUPERADMIN_EMAIL as string)?.trim() || "owner@fiscalflow.com";
  const superadminPassword =
    (process.env.SUPERADMIN_PASSWORD as string)?.trim() || "fiscalflow123";
  const superadminHashedPassword = await bcrypt.hash(superadminPassword, 10);

  // Conta e usuário superadmin (dono do sistema)
  let platformAccount = await prisma.account.findFirst({
    where: { name: "Fiscal Flow — Sistema" },
  });
  if (!platformAccount) {
    platformAccount = await prisma.account.create({
      data: {
        name: "Fiscal Flow — Sistema",
        cnpj: null,
        plan: "pro",
      },
    });
    console.log("Conta sistema criada");
  }
  const superadmin = await prisma.user.upsert({
    where: { email: superadminEmail.toLowerCase() },
    update: {
      password: superadminHashedPassword,
      role: "superadmin",
      emailVerifiedAt: new Date(),
    },
    create: {
      email: superadminEmail.toLowerCase(),
      password: superadminHashedPassword,
      name: "Owner / Superadmin",
      role: "superadmin",
      accountId: platformAccount.id,
      emailVerifiedAt: new Date(),
    },
  });
  console.log("Superadmin:", superadmin.email);

  // Conta de exemplo para escritório
  let account = await prisma.account.findFirst({
    where: { name: { not: "Fiscal Flow — Sistema" } },
  });
  if (!account) {
    account = await prisma.account.create({
      data: {
        name: "Escritório Fiscal Flow",
        plan: "pro",
      },
    });
    console.log("Conta exemplo criada:", account.name);
  }

  const examplePassword = await bcrypt.hash("fiscalflow123", 10);
  const user = await prisma.user.upsert({
    where: { email: "admin@fiscalflow.com" },
    update: { password: examplePassword, emailVerifiedAt: new Date() },
    create: {
      email: "admin@fiscalflow.com",
      password: examplePassword,
      name: "Admin Fiscal Flow",
      role: "admin",
      accountId: account.id,
      emailVerifiedAt: new Date(),
    },
  });
  console.log("Usuário exemplo:", user.email);

  // Criar cliente de exemplo se não existir
  const clientCount = await prisma.client.count({ where: { accountId: account.id } });
  if (clientCount === 0) {
    await prisma.client.create({
      data: {
        name: "Empresa Exemplo",
        cnpj: "39902640000122",
        accountId: account.id,
      },
    });
    console.log("Cliente exemplo criado");
  }

  await seedTaxRuleEngine(prisma);

  console.log("\nSeed concluído.");
  console.log(
    "  Superadmin (dono do sistema):",
    superadmin.email,
    process.env.SUPERADMIN_EMAIL ? "(via env)" : "(default)"
  );
  console.log("  Escritório exemplo: admin@fiscalflow.com / fiscalflow123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
