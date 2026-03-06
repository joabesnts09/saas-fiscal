import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth-api";

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

    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: { id, accountId },
      select: {
        id: true,
        name: true,
        cnpj: true,
        endereco: true,
        contato: true,
        responsavel: true,
        createdAt: true,
        _count: {
          select: { nfeRecords: true, prestacao: true },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const { _count, ...rest } = client;
    return NextResponse.json({
      ...rest,
      notasCount: _count.nfeRecords,
      prestacaoCount: _count.prestacao,
    });
  } catch (error) {
    console.error("Client API error:", error);
    return NextResponse.json({ error: "Erro ao buscar cliente" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const client = await prisma.client.findFirst({
      where: { id, accountId },
    });
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const { endereco, contato, responsavel } = body;

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...(typeof endereco === "string" && { endereco: endereco.trim() || null }),
        ...(typeof contato === "string" && { contato: contato.trim() || null }),
        ...(typeof responsavel === "string" && { responsavel: responsavel.trim() || null }),
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
        endereco: true,
        contato: true,
        responsavel: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Client PATCH error:", error);
    return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const accountId = auth?.accountId;
    if (!accountId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const client = await prisma.client.findFirst({
      where: { id, accountId },
    });
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Client DELETE error:", error);
    return NextResponse.json({ error: "Erro ao excluir empresa" }, { status: 500 });
  }
}
