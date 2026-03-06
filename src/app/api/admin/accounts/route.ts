import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth-api";

async function requireSuperadmin(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return { error: "Não autorizado", status: 401 };
  if (auth.role !== "superadmin") {
    return { error: "Acesso negado. Apenas superadmin.", status: 403 };
  }
  return { payload: auth };
}

export async function GET(request: Request) {
  const auth = await requireSuperadmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { users: true, clients: true },
        },
      },
    });

    const list = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      cnpj: a.cnpj,
      plan: a.plan,
      createdAt: a.createdAt,
      usersCount: a._count.users,
      clientsCount: a._count.clients,
    }));

    return NextResponse.json(list);
  } catch (error) {
    console.error("Admin accounts GET:", error);
    return NextResponse.json({ error: "Erro ao listar contas" }, { status: 500 });
  }
}
