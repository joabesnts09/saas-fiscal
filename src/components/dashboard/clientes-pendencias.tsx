"use client";

import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import type { Client } from "@/contexts/client-context";
import type { NfeRecord } from "@/lib/nfe";

const onlyDigits = (s: string | null) => (s ?? "").replace(/\D/g, "");

function matchRecordToClient(record: NfeRecord, client: Client): boolean {
  const rc = onlyDigits(record.emitente?.cnpj ?? "");
  const cc = onlyDigits(client.cnpj ?? "");
  return !!rc && !!cc && rc === cc;
}

type ClientesPendenciasProps = {
  clients: Client[];
  records: NfeRecord[];
  includedMap: Record<string, boolean>;
};

export default function ClientesPendencias({
  clients,
  records,
  includedMap,
}: ClientesPendenciasProps) {
  const data = useMemo(() => {
    return clients
      .map((client) => {
        const clientRecords = records.filter((r) => matchRecordToClient(r, client));
        const pending = clientRecords.filter(
          (r) => r.status === "Autorizada" && !includedMap[r.chave]
        );
        return { name: client.name, count: pending.length };
      })
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [clients, records, includedMap]);

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-900">
        Clientes com mais pendências
      </h3>
      <ul className="space-y-2">
        {data.map((item) => (
          <li
            key={item.name}
            className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm text-slate-800">
              <AlertCircle className="size-4 text-amber-600" />
              {item.name}
            </span>
            <span className="text-sm font-semibold text-amber-700">
              {item.count} notas
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
