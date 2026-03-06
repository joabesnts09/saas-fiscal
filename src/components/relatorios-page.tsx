"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { useClient } from "@/contexts/client-context";

export default function RelatoriosPage({ params }: { params: Promise<{ id: string }> }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const { clients, selectedClient } = useClient();
  const client = selectedClient ?? clients.find((c) => c.id === clientId) ?? null;

  useEffect(() => {
    params.then((p) => setClientId(p.id));
  }, [params]);

  if (!clientId) return null;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <p className="text-sm text-slate-500">Empresa: {client?.name ?? "..."}</p>
        <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
        <p className="mt-1 text-slate-600">Exportação e relatórios fiscais por período</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 py-16 text-center">
        <FileSpreadsheet className="mb-4 size-12 text-slate-400" />
        <p className="text-slate-600">Página em construção</p>
        <p className="mt-1 text-sm text-slate-500">Em breve: prestação de contas, fechamento mensal e exportação</p>
      </div>
    </div>
  );
}
