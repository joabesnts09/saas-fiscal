import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, type NfeRecord } from "@/lib/nfe";

type Metrics = {
  totalValue: number;
  count: number;
  authorizedCount: number;
  canceledCount: number;
  pendingValue: number;
};

type PrestacaoPanelProps = {
  records: NfeRecord[];
  metrics: Metrics;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
};

export default function PrestacaoPanel({
  records,
  metrics,
  onExportCsv,
  onExportPdf,
  onExportXlsx,
}: PrestacaoPanelProps) {
  const disabled = records.length === 0;
  const totalItems = records.reduce((acc, record) => acc + record.itens.length, 0);

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Prestação de contas automática</CardTitle>
        <p className="text-sm text-slate-500">
          Gere a planilha no layout exigido por programas públicos.
        </p>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Modelo oficial</p>
            <Badge variant="secondary">{disabled ? "Aguardando XML" : "Pronto para exportar"}</Badge>
          </div>
          <p className="text-sm text-slate-500">
            Documento com dados do emitente, chave de acesso, valor total e
            discriminação resumida dos itens.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" onClick={onExportPdf} disabled={disabled}>
              Visualizar PDF
            </Button>
            <Button onClick={onExportXlsx} disabled={disabled}>
              Gerar prestação
            </Button>
          </div>
        </div>
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">Totais do período</p>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Total de notas</span>
              <span className="font-semibold text-slate-900">{metrics.count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total vendido</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(metrics.totalValue)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Itens consolidados</span>
              <span className="font-semibold text-slate-900">{totalItems}</span>
            </div>
          </div>
          <Button variant="ghost" className="w-full" onClick={onExportCsv} disabled={disabled}>
            Baixar resumo (.csv)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
