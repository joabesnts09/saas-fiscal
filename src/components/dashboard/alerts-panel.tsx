import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, type NfeRecord } from "@/lib/nfe";

type Metrics = {
  canceledCount?: number;
  cnpjMismatchCount?: number;
  inconsistenciesCount?: number;
};

type AlertsPanelProps = {
  records: NfeRecord[];
  metrics: Metrics;
};

export default function AlertsPanel({ records, metrics }: AlertsPanelProps) {
  const canceled = records.filter((r) => r.status === "Cancelada");
  const cnpjMismatch = records.filter((r) => r.cnpjMismatch);
  const hasAlerts = canceled.length > 0 || cnpjMismatch.length > 0;

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Alertas fiscais prioritários</CardTitle>
        <p className="text-sm text-slate-500">
          Cancelamentos e divergências encontradas no XML importado.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!hasAlerts ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Nenhuma inconsistência encontrada.
          </div>
        ) : (
          <>
            {canceled.map((alert) => (
              <div
                key={alert.chave}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Nota cancelada {alert.numero}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(alert.dataEmissao)} · {alert.chave}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  Alto
                </Badge>
              </div>
            ))}
            {cnpjMismatch.map((alert) => (
              <div
                key={alert.chave}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    CNPJ da nota não confere com a empresa — {alert.numero}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(alert.dataEmissao)} · {alert.chave}
                  </p>
                </div>
                <Badge variant="outline" className="border-amber-400 text-xs text-amber-700">
                  Médio
                </Badge>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
