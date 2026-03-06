"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/nfe";
import type { NfeRecord } from "@/lib/nfe";

type Top5ProdutosProps = {
  records: NfeRecord[];
  clientCnpj?: string | null;
  selectedMonth: string;
};

export default function Top5Produtos({
  records,
  selectedMonth,
}: Top5ProdutosProps) {
  const data = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const monthRecords = records.filter((r) => {
      const d = new Date(r.dataEmissao);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    const byProduct = new Map<string, { name: string; total: number }>();
    monthRecords.forEach((r) => {
      r.itens.forEach((item) => {
        const key = item.productId || item.description || "sem-id";
        const name = item.description || item.productId || "Item";
        const totalItems = r.itens.reduce((a, i) => a + (i.quantity || 0), 0);
        const val = (item.quantity || 0) * ((r.valorTotal || 0) / Math.max(1, totalItems));
        const curr = byProduct.get(key);
        byProduct.set(key, { name: curr?.name ?? name, total: (curr?.total ?? 0) + val });
      });
    });
    return Array.from(byProduct.values())
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [records, selectedMonth]);

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Top 5 Produtos</h3>
      <ul className="space-y-2">
        {data.map((item) => (
          <li
            key={item.name}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
          >
            <span className="truncate text-sm text-slate-800">
              {item.name.length > 28 ? `${item.name.slice(0, 28)}...` : item.name}
            </span>
            <span className="shrink-0 text-sm font-semibold text-emerald-700">
              {formatCurrency(item.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
