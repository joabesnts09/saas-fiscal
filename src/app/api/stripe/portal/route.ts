import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const s = session as { accountId?: string } | null;
    if (!s?.accountId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const account = await prisma.account.findUnique({
      where: { id: s.accountId },
    });
    if (!account?.stripeCustomerId) {
      return NextResponse.json(
        { error: "Nenhuma assinatura ativa para gerenciar" },
        { status: 400 }
      );
    }

    const origin = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${origin}/planos`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Stripe portal error:", error);
    return NextResponse.json(
      { error: "Erro ao abrir portal de cobrança" },
      { status: 500 }
    );
  }
}
