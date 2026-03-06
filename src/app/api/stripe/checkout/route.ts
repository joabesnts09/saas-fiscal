import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/db";
import { stripe, STRIPE_PRICE_PRO } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const s = session as { userId?: string; accountId?: string; email?: string } | null;
    if (!s?.accountId || !s?.userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const priceId = (body.priceId as string) || STRIPE_PRICE_PRO;
    if (!priceId) {
      return NextResponse.json(
        { error: "STRIPE_PRICE_ID_PRO não configurado" },
        { status: 500 }
      );
    }

    const account = await prisma.account.findUnique({
      where: { id: s.accountId },
      include: { users: { take: 1 } },
    });
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    let customerId = account.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: s.email ?? account.users[0]?.email ?? undefined,
        name: account.name,
        metadata: { accountId: account.id },
      });
      customerId = customer.id;
      await prisma.account.update({
        where: { id: account.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const origin = request.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/planos?success=true`,
      cancel_url: `${origin}/planos?canceled=true`,
      metadata: { accountId: account.id },
      subscription_data: { metadata: { accountId: account.id } },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Erro ao criar sessão de checkout" },
      { status: 500 }
    );
  }
}
