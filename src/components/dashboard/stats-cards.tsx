import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/nfe";

type Metrics = {
  totalValue: number;
  count: number;
  authorizedCount: number;
  canceledCount: number;
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
    },
    {
      title: "Notas processadas",
      value: metrics.count.toLocaleString("pt-BR"),
      change: "XMLs importados",
    },
    {
      title: "Prestação pendente",
      value: formatCurrency(metrics.pendingValue),
      change: `${metrics.pendingCount} notas sem relatório`,
    },
    {
      title: "Inconsistências",
      value: `${metrics.canceledCount} alertas`,
      change: "Notas canceladas",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              {card.title}
            </CardTitle>
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
