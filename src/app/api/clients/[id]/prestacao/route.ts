import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth-api";

async function verifyClientAccess(clientId: string, accountId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, accountId },
  });
  return client;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: clientId } = await params;
    const client = await verifyClientAccess(clientId, accountId);
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const items = await prisma.prestacaoIncluida.findMany({
      where: { clientId },
      select: { chave: true },
    });

    const chaves = items.map((i) => i.chave);
    const includedMap = Object.fromEntries(chaves.map((c) => [c, true]));
    return NextResponse.json({ chaves, includedMap });
  } catch (error) {
    console.error("Prestacao GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar prestação" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: clientId } = await params;
    const client = await verifyClientAccess(clientId, accountId);
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const chaves = Array.isArray(body.chaves) ? body.chaves : body.includedMap ? Object.keys(body.includedMap).filter((k: string) => body.includedMap[k]) : [];

    await prisma.prestacaoIncluida.deleteMany({ where: { clientId } });

    if (chaves.length > 0) {
      await prisma.prestacaoIncluida.createMany({
        data: chaves.map((chave: string) => ({ clientId, chave })),
        skipDuplicates: true,
      });
    }

    const items = await prisma.prestacaoIncluida.findMany({
      where: { clientId },
      select: { chave: true },
    });
    const includedMap = Object.fromEntries(items.map((i) => [i.chave, true]));
    return NextResponse.json({ chaves: items.map((i) => i.chave), includedMap });
  } catch (error) {
    console.error("Prestacao PUT error:", error);
    return NextResponse.json({ error: "Erro ao salvar prestação" }, { status: 500 });
  }
}
