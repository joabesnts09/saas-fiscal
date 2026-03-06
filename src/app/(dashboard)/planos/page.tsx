"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, CreditCard, Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "@/lib/toast";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "R$ 0",
    period: "/mês",
    priceId: null as string | null,
    description: "Ideal para começar",
    icon: Sparkles,
    features: [
      "1 empresa cadastrada",
      "Importação de até 20 notas por vez",
      "Relatórios básicos",
      "Exportação em planilha",
    ],
    popular: false,
  },
  {
    id: "pago",
    name: "Pro",
    price: "R$ 49",
    period: "/mês",
    priceId: null as string | null,
    description: "Para escritórios em crescimento",
    icon: Zap,
    features: [
      "Empresas ilimitadas",
      "Importação ilimitada de notas",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
    popular: true,
  },
] as const;

export default function PlanosPage() {
  const { data: session, update: updateSession } = useSession();
  const searchParams = useSearchParams();
  const currentPlan = (session as { plan?: string } | null)?.plan ?? "free";
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (success === "true") {
      toast.success("Assinatura realizada com sucesso! Seu plano foi atualizado.");
      updateSession();
      window.history.replaceState({}, "", "/planos");
    } else if (canceled === "true") {
      toast.error("Checkout cancelado.");
      window.history.replaceState({}, "", "/planos");
    }
  }, [searchParams]);

  const handleSubscribe = async (planId: string) => {
    if (planId !== "pago") return;
    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar checkout");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar. Tente novamente.");
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao abrir portal");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar. Tente novamente.");
    } finally {
      setLoading(null);
    }
  };

  const isPro = currentPlan === "pro" || currentPlan === "enterprise";

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100">
          <CreditCard className="size-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planos</h1>
          <p className="mt-1 text-slate-600">
            Escolha o plano ideal para o seu escritório
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {PLANS.map((plan) => {
          const isCurrent =
            (plan.id === "free" && currentPlan === "free") ||
            (plan.id === "pago" && isPro);
          const Icon = plan.icon;
          const isFree = plan.id === "free";

          const getButtonContent = () => {
            if (isFree) {
              return isCurrent ? "Plano atual" : null;
            }
            if (isCurrent) {
              return "Gerenciar assinatura";
            }
            return "Assinar";
          };

          const buttonContent = getButtonContent();
          const isButtonLoading =
            (plan.id === "pago" && (loading === "pago" || loading === "portal")) || loading === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-lg transition hover:shadow-xl ${
                plan.popular
                  ? "border-emerald-500 ring-2 ring-emerald-500/20"
                  : isFree
                    ? "border-slate-300 bg-slate-50/50"
                    : "border-slate-200"
              }`}
            >
              {plan.popular && (
                <div className="absolute right-0 top-0 rounded-bl-xl bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white">
                  Popular
                </div>
              )}

              <div className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`flex size-11 items-center justify-center rounded-xl ${
                      isFree ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                    <p className="text-sm text-slate-500">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-500">{plan.period}</span>
                </div>

                <ul className="mb-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-slate-700">
                      <span
                        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                          isFree ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-600"
                        }`}
                      >
                        <Check className="size-3" />
                      </span>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {buttonContent && (
                  <button
                    type="button"
                    disabled={(isFree && isCurrent) || isButtonLoading}
                    onClick={() =>
                      isFree
                        ? undefined
                        : isCurrent
                          ? handleManageSubscription()
                          : handleSubscribe(plan.id)
                    }
                    className={`w-full rounded-xl py-3 text-sm font-semibold transition ${
                      isFree
                        ? "cursor-default border-2 border-slate-300 bg-slate-100 text-slate-700"
                        : plan.popular
                          ? "border-2 border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                          : "cursor-default border border-slate-200 bg-slate-50 text-slate-500"
                    } ${!isFree && !isCurrent ? "hover:bg-emerald-500 hover:text-white hover:border-emerald-500" : ""}`}
                  >
                    {isButtonLoading ? (
                      <>
                        <Loader2 className="mr-2 inline-block size-4 animate-spin" />
                        Redirecionando...
                      </>
                    ) : (
                      buttonContent
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isPro && (
        <p className="mt-6 text-center text-sm text-slate-500">
          Gerenciar assinatura, método de pagamento e faturas no portal do Stripe.
        </p>
      )}
    </div>
  );
}
