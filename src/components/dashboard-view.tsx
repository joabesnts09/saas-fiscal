"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, UploadCloud } from "lucide-react";
import ClientSelector from "@/components/client-selector";
import Top5Produtos from "@/components/dashboard/top5-produtos";
import FaturamentoMensalChart from "@/components/dashboard/faturamento-mensal-chart";
import PrestacaoInconsistenciasChart from "@/components/dashboard/prestacao-inconsistencias-chart";
import StatsCards from "@/components/dashboard/stats-cards";
import NotesTableView from "@/components/dashboard/notes-table-view";
import NoteDetailsDialog from "@/components/dashboard/note-details-dialog";
import { useClient } from "@/contexts/client-context";
import { useNotes } from "@/contexts/notes-context";
import type { NfeRecord } from "@/lib/nfe";

function getMonthsFromRecords(records: NfeRecord[]): { value: string; label: string }[] {
  const monthSet = new Set<string>();
  for (const r of records) {
    const d = r.dataEmissao?.trim();
    if (!d || d.length < 7) continue;
    const yyyyMm = d.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(yyyyMm)) monthSet.add(yyyyMm);
  }
  return Array.from(monthSet)
    .sort((a, b) => b.localeCompare(a))
    .map((value) => {
      const [y, m] = value.split("-");
      const date = new Date(Number(y), Number(m) - 1, 1);
      const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
}

export default function DashboardView() {
  const { clients, selectedClient } = useClient();
  const { records, includedMap, loading, updateRecord, deleteRecord } = useNotes();
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<NfeRecord | null>(null);

  const clientRecords = useMemo(() => {
    if (!selectedClient) return [];
    return records;
  }, [records, selectedClient]);

  const monthOptions = useMemo(
    () => getMonthsFromRecords(clientRecords),
    [clientRecords]
  );

  useEffect(() => {
    if (monthOptions.length === 0) {
      setSelectedMonth("");
    } else {
      const valid = monthOptions.some((o) => o.value === selectedMonth);
      if (!valid) setSelectedMonth(monthOptions[0]!.value);
    }
  }, [monthOptions, selectedMonth]);

  const notesByMonth = useMemo(() => {
    if (!selectedClient || !selectedMonth) return [];
    const prefix = `${selectedMonth}-`;
    return clientRecords.filter((r) => {
      const d = r.dataEmissao?.trim() ?? "";
      return d.length >= 7 && (d.slice(0, 7) === selectedMonth || d.startsWith(prefix));
    });
  }, [clientRecords, selectedMonth]);

  const metrics = useMemo(() => {
    const totalValue = clientRecords.reduce((acc, r) => acc + r.valorTotal, 0);
    const authorized = clientRecords.filter((r) => r.status === "Autorizada");
    const canceled = clientRecords.filter((r) => r.status === "Cancelada");
    const cnpjMismatchCount = clientRecords.filter((r) => r.cnpjMismatch).length;
    const pending = authorized.filter((r) => !includedMap[r.chave]);
    const included = authorized.filter((r) => includedMap[r.chave]);
    return {
      totalValue,
      count: clientRecords.length,
      authorizedCount: authorized.length,
      canceledCount: canceled.length,
      cnpjMismatchCount,
      inconsistenciesCount: canceled.length + cnpjMismatchCount,
      pendingValue: pending.reduce((acc, r) => acc + r.valorTotal, 0),
      pendingCount: pending.length,
      includedCount: included.length,
    };
  }, [clientRecords, includedMap]);

  const monthTotal = useMemo(() => notesByMonth.reduce((acc, r) => acc + r.valorTotal, 0), [notesByMonth]);

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-sm text-slate-500">Empresa: {selectedClient?.name ?? "—"}</p>
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            </div>
            <ClientSelector />
          </div>
          <Link href={selectedClient ? `/empresas/${selectedClient.id}/documentos` : "/empresas"}>
            <Button className="gap-2">
              <UploadCloud className="size-4" />
              Gerenciar notas
            </Button>
          </Link>
        </div>
      </header>

      <section className="px-6 py-6">
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : selectedClient ? (
          <>
            <div className="mb-6">
              <StatsCards metrics={metrics} />
            </div>

            <div className="mb-6 flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Mês</label>
                {monthOptions.length === 0 ? (
                  <div className="flex h-9 w-[220px] items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                    Nenhum mês disponível
                  </div>
                ) : (
                  <Select value={selectedMonth || monthOptions[0]?.value} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="h-9 w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Link href={selectedClient ? `/empresas/${selectedClient.id}/documentos` : "/empresas"}>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <FileText className="size-4" />
                  Upload, editar e exportar XMLs
                </Button>
              </Link>
            </div>

            <div className="mb-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Relatórios analíticos</h2>
              <div className="mb-6">
                <FaturamentoMensalChart
                  records={clientRecords}
                  clientCnpj={selectedClient.cnpj}
                  selectedMonth={selectedMonth}
                />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <PrestacaoInconsistenciasChart
                  records={clientRecords}
                  clientCnpj={selectedClient.cnpj}
                  includedMap={includedMap}
                  selectedMonth={selectedMonth}
                />
                <Top5Produtos
                  records={clientRecords}
                  clientCnpj={selectedClient.cnpj}
                  selectedMonth={selectedMonth}
                />
              </div>
            </div>

            <div className="mb-4 flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-900">Notas fiscais do mês</h2>
              <span className="text-sm text-slate-600">
                {notesByMonth.length} notas · {monthTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
              <Link href={selectedClient ? `/empresas/${selectedClient.id}/documentos` : "/empresas"} className="ml-auto">
                <Button variant="link" className="gap-2 text-emerald-600">
                  Ir para gestão completa
                  <FileText className="size-4" />
                </Button>
              </Link>
            </div>
            <NotesTableView records={notesByMonth} onSelectRecord={setSelectedRecord} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-slate-600">Selecione um cliente</p>
            <p className="mt-1 text-sm text-slate-500">
              Escolha uma empresa no seletor acima para ver o dashboard
            </p>
            <Link href={clients.length > 0 ? `/empresas/${clients[0].id}/documentos` : "/empresas"} className="mt-6">
              <Button className="gap-2">
                <UploadCloud className="size-4" />
                Gerenciar notas fiscais
              </Button>
            </Link>
          </div>
        )}
      </section>

      <NoteDetailsDialog
        record={selectedRecord}
        open={Boolean(selectedRecord)}
        onOpenChange={(open) => !open && setSelectedRecord(null)}
        onSave={updateRecord}
        onDelete={deleteRecord}
      />
    </div>
  );
}
