import { NextRequest, NextResponse } from "next/server";
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

const PLANS = ["free", "pro", "enterprise"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { plan } = body;

    if (!plan || !PLANS.includes(plan)) {
      return NextResponse.json(
        { error: "Plano inválido. Use: free, pro ou enterprise" },
        { status: 400 }
      );
    }

    const account = await prisma.account.update({
      where: { id },
      data: { plan },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("Admin account PATCH:", error);
    return NextResponse.json({ error: "Erro ao atualizar conta" }, { status: 500 });
  }
}
