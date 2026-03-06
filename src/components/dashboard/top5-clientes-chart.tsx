"use client";

import { useMemo } from "react";
import {
  Building2,
  Store,
  ShoppingCart,
  Briefcase,
  Package,
} from "lucide-react";
import { formatCurrency } from "@/lib/nfe";
import type { Client } from "@/contexts/client-context";
import type { NfeRecord } from "@/lib/nfe";

const onlyDigits = (s: string | null) => (s ?? "").replace(/\D/g, "");

const ICONS = [Building2, Store, ShoppingCart, Briefcase, Package];

function matchRecordToClient(record: NfeRecord, client: Client): boolean {
  const recordCnpj = onlyDigits(record.emitente?.cnpj ?? "");
  const clientCnpj = onlyDigits(client.cnpj ?? "");
  if (!recordCnpj || !clientCnpj) return false;
  return recordCnpj === clientCnpj;
}

type Top5ClientesChartProps = {
  clients: Client[];
  records: NfeRecord[];
};

export default function Top5ClientesChart({ clients, records }: Top5ClientesChartProps) {
  const data = useMemo(() => {
    const items = clients.map((client) => {
      const clientRecords = records.filter((r) => matchRecordToClient(r, client));
      const total = clientRecords.reduce((acc, r) => acc + r.valorTotal, 0);
      return {
        name: client.name,
        total,
        count: clientRecords.length,
      };
    });
    return items
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [clients, records]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-500">Sem dados para exibir</p>
        <p className="mt-1 text-sm text-slate-400">
          Importe notas na página Documentos fiscais para ver o Top 5 Clientes
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Top 5 Clientes</h3>
      <ul className="space-y-3">
        {data.map((item, index) => {
          const Icon = ICONS[index % ICONS.length];
          return (
            <li
              key={item.name}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Icon className="size-4" />
                </div>
                <span className="truncate text-sm font-medium text-slate-900">
                  {item.name}
                </span>
              </div>
              <span className="shrink-0 text-sm font-semibold text-emerald-700">
                {formatCurrency(item.total)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
