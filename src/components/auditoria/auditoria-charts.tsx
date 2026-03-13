"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PieChart, Pie, Cell, Tooltip as PieTooltip } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/nfe";

const CFOP_DESCRICOES: Record<string, string> = {
  "5101": "Venda de produção do estabelecimento (Intraestadual)",
  "5102": "Venda de mercadoria adquirida ou recebida de terceiros (Intraestadual)",
  "5103": "Venda de produção do estabelecimento efetuada fora do estabelecimento",
  "5104": "Venda de mercadoria adquirida ou recebida de terceiros, efetuada fora do estabelecimento",
  "5405": "Venda de mercadoria com Substituição Tributária (Intraestadual)",
  "6101": "Compra para industrialização ou produção rural",
  "6102": "Compra para comercialização (entrada de mercadoria para revenda)",
  "6103": "Compra para industrialização em operação com ST",
  "6104": "Compra para comercialização em operação com ST",
  "6401": "Prestação de serviço de transporte (entrada)",
  "6403": "Prestação de serviço de transporte a estabelecimento industrial",
  "6404": "Venda de mercadoria — frete (Saída)",
  "6910": "Outras entradas de mercadorias ou aquisições de serviços",
};

function getCfopDescricao(cfop: string): string {
  return CFOP_DESCRICOES[cfop] ?? `CFOP ${cfop} — Operação fiscal (consulte a tabela oficial para detalhes)`;
}

type Stats = {
  totalICMS: number;
  totalPIS: number;
  totalCOFINS: number;
  topCfops: { cfop: string; count: number }[];
  topNcms: { ncm: string; count: number }[];
  icmsByMonth: { mes: string; valor: number }[];
};

const CFOP_COLORS = ["#0ea5e9", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1", "#f97316", "#14b8a6"];
const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Props = {
  stats: Stats | null;
};

export default function AuditoriaCharts({ stats }: Props) {
  const icmsChartData = useMemo(() => {
    if (!stats?.icmsByMonth?.length) return [];
    return stats.icmsByMonth.map(({ mes, valor }) => {
      const [, m] = mes.split("-");
      const monthLabel = MONTH_NAMES[Number(m) - 1] ?? mes;
      return { mes: monthLabel, valor, fullMes: mes };
    });
  }, [stats?.icmsByMonth]);

  const cfopChartData = useMemo(() => {
    if (!stats?.topCfops?.length) return [];
    const total = stats.topCfops.reduce((a, c) => a + c.count, 0);
    const mapped = stats.topCfops.map(({ cfop, count }) => ({
      name: cfop,
      value: total > 0 ? Math.round((count / total) * 100) : 0,
      count,
      fill: "",
    }));
    const sorted = [...mapped].sort((a, b) => b.value - a.value);
    return sorted.map((item, i) => ({ ...item, fill: CFOP_COLORS[i % CFOP_COLORS.length] }));
  }, [stats?.topCfops]);

  const [selectedCfop, setSelectedCfop] = useState<{ name: string; count: number; value: number } | null>(null);

  const topNcmData = useMemo(() => stats?.topNcms?.slice(0, 10) ?? [], [stats?.topNcms]);

  if (!stats) return null;

  return (
    <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* ICMS por mês */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-slate-900">ICMS por mês</h3>
        {icmsChartData.length > 0 ? (
          <div className="h-[140px] min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={icmsChartData} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : String(v))} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  formatter={(v) => [formatCurrency(Number(v) || 0), "ICMS"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="valor" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">Sem dados de ICMS por mês</p>
        )}
        {icmsChartData.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">Total do período</p>
            <p className="text-sm font-semibold text-slate-900">
              {formatCurrency(icmsChartData.reduce((a, d) => a + d.valor, 0))}
            </p>
          </div>
        )}
      </div>

      {/* Distribuição de CFOP */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-slate-900">Distribuição de CFOP</h3>
        {cfopChartData.length > 0 ? (
          <div className="h-[140px] min-h-0 cursor-pointer overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={cfopChartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={32}
                  outerRadius={52}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={false}
                  onClick={(_, index) => {
                    const item = cfopChartData[index];
                    if (item) setSelectedCfop({ name: item.name, count: item.count, value: item.value });
                  }}
                >
                  {cfopChartData.map((entry, i) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <PieTooltip
                  formatter={(value, name, props) => [
                    `${props?.payload?.count ?? 0} itens (${value}%) — Clique para detalhes`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">Sem dados de CFOP</p>
        )}
        {cfopChartData.length > 0 && (
          <>
            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {cfopChartData.map(({ name, count, value, fill }) => (
                <button
                  key={name}
                  type="button"
                  className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 transition-colors hover:text-slate-900"
                  onClick={() => setSelectedCfop({ name, count, value })}
                >
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: fill }} />
                  <span className="font-mono">{name} ({value}%)</span>
                </button>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs text-slate-500">Resumo (clique para detalhes)</p>
              <ul className="space-y-1 text-xs">
                {cfopChartData.slice(0, 5).map(({ name, count, value }) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer justify-between text-left transition-colors hover:text-slate-900"
                      onClick={() => setSelectedCfop({ name, count, value })}
                    >
                      <span className="font-mono text-slate-700">{name}</span>
                      <span className="text-slate-600">{count} itens ({value}%)</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Top NCM e Tributos */}
      <div className="flex flex-col gap-4 md:col-span-2 lg:col-span-1">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Top NCM utilizados</h3>
          {topNcmData.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {topNcmData.map(({ ncm, count }) => (
                <li key={ncm} className="flex items-center justify-between font-mono">
                  <span className="text-slate-700">{ncm}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">{count} itens</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-slate-500">Sem dados de NCM</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Tributos totais</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">ICMS</span>
              <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(stats.totalICMS)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">PIS</span>
              <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(stats.totalPIS)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">COFINS</span>
              <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(stats.totalCOFINS)}</span>
            </div>
            <hr className="border-slate-200" />
            <div className="flex justify-between text-sm font-medium">
              <span className="text-slate-700">Total</span>
              <span className="tabular-nums text-slate-900">
                {formatCurrency(stats.totalICMS + stats.totalPIS + stats.totalCOFINS)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedCfop} onOpenChange={(open) => !open && setSelectedCfop(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>CFOP {selectedCfop?.name}</DialogTitle>
          </DialogHeader>
          {selectedCfop && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                {getCfopDescricao(selectedCfop.name)}
              </p>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p><span className="font-medium text-slate-600">Itens neste período:</span> {selectedCfop.count}</p>
                <p><span className="font-medium text-slate-600">Participação:</span> {selectedCfop.value}%</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
