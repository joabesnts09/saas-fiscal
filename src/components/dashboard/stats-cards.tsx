import { BadgeCheck, AlertTriangle, FileText, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/nfe";

type Metrics = {
  totalValue: number;
  count: number;
  authorizedCount: number;
  canceledCount: number;
  cnpjMismatchCount?: number;
  inconsistenciesCount?: number;
  pendingValue: number;
  pendingCount: number;
};

type StatsCardsProps = {
  metrics: Metrics;
};

export default function StatsCards({ metrics }: StatsCardsProps) {
  const cards = [
    {
      title: "Total faturado",
      value: formatCurrency(metrics.totalValue),
      change: `${metrics.authorizedCount} notas autorizadas`,
      icon: Wallet,
      iconClass: "bg-emerald-100 text-emerald-600",
    },
    {
      title: "Notas processadas",
      value: metrics.count.toLocaleString("pt-BR"),
      change: "XMLs importados",
      icon: FileText,
      iconClass: "bg-blue-100 text-blue-600",
    },
    {
      title: "Prestação pendente",
      value: formatCurrency(metrics.pendingValue),
      change: `${metrics.pendingCount} notas sem relatório`,
      icon: BadgeCheck,
      iconClass: "bg-amber-100 text-amber-600",
    },
    {
      title: "Inconsistências",
      value: `${metrics.inconsistenciesCount ?? metrics.canceledCount} alertas`,
      change: metrics.cnpjMismatchCount
        ? "Notas canceladas e CNPJ divergente"
        : "Notas canceladas",
      icon: AlertTriangle,
      iconClass: "bg-rose-100 text-rose-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              {card.title}
            </CardTitle>
            <div className={`flex size-9 items-center justify-center rounded-full ${card.iconClass}`}>
              <card.icon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-2 text-xs text-slate-500">{card.change}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
