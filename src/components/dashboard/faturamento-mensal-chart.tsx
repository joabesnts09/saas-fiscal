"use client";

import { useMemo } from "react";
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from "recharts";
import { formatCurrency } from "@/lib/nfe";
import type { NfeRecord } from "@/lib/nfe";

type Props = {
  records: NfeRecord[];
  clientCnpj?: string | null;
  selectedMonth: string;
};

export default function FaturamentoMensalChart({ records, selectedMonth }: Props) {
  const data = useMemo(() => {
    const [selYear] = selectedMonth.split("-").map(Number);
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const byMonth = new Map<string, number>();
    for (let m = 1; m <= 12; m++) byMonth.set(`${selYear}-${String(m).padStart(2, "0")}`, 0);
    records.forEach((r) => {
      const d = new Date(r.dataEmissao);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== selYear) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + r.valorTotal);
    });
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, total]) => {
        const [, month] = key.split("-");
        return { mes: monthNames[Number(month) - 1], total };
      });
  }, [records, selectedMonth]);

  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Faturamento mensal</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis tickFormatter={(v) => (v >= 1000 ? (v / 1000) + "k" : String(v))} tick={{ fontSize: 11, fill: "#64748b" }} domain={[0, maxVal * 1.1]} />
            <Tooltip formatter={(v) => [formatCurrency(Number(v) || 0), "Faturamento"]} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
            <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
            <Line type="monotone" dataKey="total" stroke="#059669" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
