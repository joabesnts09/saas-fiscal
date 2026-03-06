import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth-api";

export async function GET(request: Request) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const clients = await prisma.client.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        cnpj: true,
        endereco: true,
        contato: true,
        responsavel: true,
      },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Clients API error:", error);
    return NextResponse.json({ error: "Erro ao buscar clientes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, cnpj } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { _count: { select: { clients: true } } },
    });
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    if (account.plan === "free" && account._count.clients >= 1) {
      return NextResponse.json(
        { error: "Plano Free permite apenas 1 empresa. Faça upgrade para adicionar mais." },
        { status: 403 }
      );
    }

    const client = await prisma.client.create({
      data: {
        accountId,
        name: name.trim(),
        cnpj: cnpj ? String(cnpj).trim().replace(/\D/g, "") || null : null,
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
      },
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error("Clients POST error:", error);
    return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 500 });
  }
}
