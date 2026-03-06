"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/nfe";
import type { NfeRecord } from "@/lib/nfe";

const COLORS = ["#eab308", "#ef4444", "#10b981"];

type PrestacaoInconsistenciasChartProps = {
  records: NfeRecord[];
  clientCnpj?: string | null;
  includedMap: Record<string, boolean>;
  selectedMonth: string;
};

export default function PrestacaoInconsistenciasChart({
  records,
  includedMap,
  selectedMonth,
}: PrestacaoInconsistenciasChartProps) {
  const data = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const clientRecords = records.filter((r) => {
      const d = new Date(r.dataEmissao);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() + 1 === month;
    });

    const authorized = clientRecords.filter((r) => r.status === "Autorizada");
    const pending = authorized.filter((r) => !includedMap[r.chave]);
    const included = authorized.filter((r) => includedMap[r.chave]);
    const canceled = clientRecords.filter((r) => r.status === "Cancelada");
    const cnpjMismatch = clientRecords.filter((r) => r.cnpjMismatch);
    const inconsistent = [...new Map([...canceled, ...cnpjMismatch].map((r) => [r.chave, r])).values()];

    const pendingVal = pending.reduce((a, r) => a + r.valorTotal, 0);
    const incVal = inconsistent.reduce((a, r) => a + r.valorTotal, 0);
    const totalVal = included.reduce((a, r) => a + r.valorTotal, 0);

    return [
      { name: "Pendentes", value: pending.length, valor: pendingVal, fill: COLORS[0] },
      { name: "Inconsistências", value: inconsistent.length, valor: incVal, fill: COLORS[1] },
      { name: "Incluídos", value: included.length, valor: totalVal, fill: COLORS[2] },
    ].filter((d) => d.value > 0);
  }, [records, includedMap, selectedMonth]);

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-900">
        Prestação e Inconsistências
      </h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={({ name, value }) => `${name}: ${value}`}
            >
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, props) => [
                `${value ?? 0} notas · ${formatCurrency(props?.payload?.valor ?? 0)}`,
                name,
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
