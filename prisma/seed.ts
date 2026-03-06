import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5454/fiscal_flow";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

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
