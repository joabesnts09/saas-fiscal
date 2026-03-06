"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { ArrowUpRight, FileEdit, Loader2, UploadCloud } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCnpj, formatCurrency, formatDate, getMonthLabel, parseNfeXml, summarizeItems, type NfeRecord } from "@/lib/nfe";
import AlertsPanel from "@/components/dashboard/alerts-panel";
import NoteDetailsDialog from "@/components/dashboard/note-details-dialog";
import NotesTable, {
  type NotesTableFilters,
  type NotesTableFilterHandlers,
} from "@/components/dashboard/notes-table";
import HeaderEditModal from "@/components/dashboard/header-edit-modal";
import PrestacaoPanel from "@/components/dashboard/prestacao-panel";
import StatsCards from "@/components/dashboard/stats-cards";
import { TopbarSearch } from "@/components/dashboard/topbar";
import ClientSelector from "@/components/client-selector";
import { useClient } from "@/contexts/client-context";
import { useNotes } from "@/contexts/notes-context";
import { useConfirm } from "@/components/confirm-dialog";
import { toast } from "@/lib/toast";

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
      const d = new Date(Number(y), Number(m) - 1, 1);
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function DocumentosManager() {
  const { selectedClient, refetch } = useClient();
  const [headerModalOpen, setHeaderModalOpen] = useState(false);
  const { confirm } = useConfirm();
  const { records, includedMap, loading: notesLoading, uploadProgress, addRecords, setIncludedMap, updateRecord, deleteRecord, deleteByMonth } = useNotes();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Autorizada" | "Cancelada">("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [productIdsFilter, setProductIdsFilter] = useState<string[]>([]);
  const [descriptionsFilter, setDescriptionsFilter] = useState<string[]>([]);
  const [cestsFilter, setCestsFilter] = useState<string[]>([]);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<NfeRecord | null>(null);
  const [deleteMonthLoading, setDeleteMonthLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const monthFilteredRecords = useMemo(() => {
    if (!selectedMonth) return [];
    const prefix = `${selectedMonth}-`;
    return clientRecords.filter((r) => {
      const d = r.dataEmissao?.trim() ?? "";
      return d.length >= 7 && (d.slice(0, 7) === selectedMonth || d.startsWith(prefix));
    });
  }, [clientRecords, selectedMonth]);

  const productIds = useMemo(() => {
    const set = new Set<string>();
    monthFilteredRecords.forEach((r) => r.itens.forEach((i) => i.productId && set.add(i.productId)));
    return Array.from(set);
  }, [monthFilteredRecords]);

  const descriptions = useMemo(() => {
    const set = new Set<string>();
    monthFilteredRecords.forEach((r) => r.itens.forEach((i) => i.description && set.add(i.description)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [monthFilteredRecords]);

  const cests = useMemo(() => {
    const set = new Set<string>();
    monthFilteredRecords.forEach((r) => r.itens.forEach((i) => i.cest && set.add(i.cest)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [monthFilteredRecords]);

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    monthFilteredRecords.forEach((r) => {
      if (r.emitente.cnpj) map.set(r.emitente.cnpj, r.emitente.razaoSocial || r.emitente.cnpj);
    });
    return Array.from(map.entries()).map(([cnpj, razaoSocial]) => ({ cnpj, razaoSocial }));
  }, [monthFilteredRecords]);

  const filteredRecords = useMemo(() => {
    const q = query.toLowerCase();
    const pidFilter = productIdsFilter.map((x) => x.trim().toLowerCase()).filter(Boolean);
    const descFilter = descriptionsFilter.map((x) => x.trim().toLowerCase()).filter(Boolean);
    const cestFilter = cestsFilter.map((x) => x.trim().toLowerCase()).filter(Boolean);
    const min = Number.parseFloat(minValue.replace(",", ".")) || 0;
    const max = Number.parseFloat(maxValue.replace(",", ".")) || Number.POSITIVE_INFINITY;
    return monthFilteredRecords.filter((record) => {
      const mq = !q || [record.chave, record.numero].some((x) => x.toLowerCase().includes(q)) ||
        record.itens.some((i) => i.productId.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || (i.cest && i.cest.toLowerCase().includes(q)));
      const mp = pidFilter.length === 0 || record.itens.some((i) => pidFilter.includes(i.productId.toLowerCase()));
      const md = descFilter.length === 0 || record.itens.some((i) => descFilter.includes(i.description.toLowerCase()));
      const mc = cestFilter.length === 0 || record.itens.some((i) => i.cest && cestFilter.includes(i.cest.toLowerCase()));
      const ms = statusFilter === "all" || record.status === statusFilter;
      const mco = companyFilter === "all" || record.emitente.cnpj === companyFilter;
      const mv = record.valorTotal >= min && record.valorTotal <= max;
      return mq && mp && md && mc && ms && mco && mv;
    });
  }, [monthFilteredRecords, query, productIdsFilter, descriptionsFilter, cestsFilter, statusFilter, companyFilter, minValue, maxValue]);

  const metrics = useMemo(() => {
    const totalValue = monthFilteredRecords.reduce((a, r) => a + r.valorTotal, 0);
    const authorized = monthFilteredRecords.filter((r) => r.status === "Autorizada");
    const canceled = monthFilteredRecords.filter((r) => r.status === "Cancelada");
    const cnpjMismatchCount = monthFilteredRecords.filter((r) => r.cnpjMismatch).length;
    const pending = authorized.filter((r) => !includedMap[r.chave]);
    const included = authorized.filter((r) => includedMap[r.chave]);
    return {
      totalValue,
      count: monthFilteredRecords.length,
      authorizedCount: authorized.length,
      canceledCount: canceled.length,
      cnpjMismatchCount,
      inconsistenciesCount: canceled.length + cnpjMismatchCount,
      pendingValue: pending.reduce((a, r) => a + r.valorTotal, 0),
      pendingCount: pending.length,
      includedCount: included.length,
    };
  }, [monthFilteredRecords, includedMap]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const parsed: NfeRecord[] = [];
      const fileList = Array.from(files);
      for (const file of fileList) {
        if (file.name.toLowerCase().endsWith(".zip")) {
          try {
            const zip = await JSZip.loadAsync(file);
            const entries = Object.values(zip.files).filter((e) => !e.dir && e.name.toLowerCase().endsWith(".xml"));
            const texts = await Promise.all(entries.map((e) => e.async("text")));
            const results = texts.map((t) => parseNfeXml(t)).filter((r): r is NfeRecord => !!r?.chave);
            parsed.push(...results);
          } catch {
            /* ignore */
          }
        } else {
          try {
            const text = await file.text();
            const r = parseNfeXml(text);
            if (r?.chave) parsed.push(r);
          } catch {
            /* ignore */
          }
        }
      }
      await addRecords(parsed);
    } finally {
      setUploading(false);
    }
  };

  const exportSource = useMemo(() => {
    const inc = monthFilteredRecords.filter((r) => includedMap[r.chave]);
    return inc.length > 0 ? inc : filteredRecords;
  }, [monthFilteredRecords, filteredRecords, includedMap]);

  const allSelected = useMemo(() => {
    if (filteredRecords.length === 0) return false;
    return filteredRecords.every((r) => includedMap[r.chave]);
  }, [filteredRecords, includedMap]);

  const getExportHeader = () => {
    const first = exportSource[0];
    const empresa = first?.emitente?.razaoSocial ?? selectedClient?.name ?? "—";
    const cnpj = formatCnpj(first?.emitente?.cnpj ?? selectedClient?.cnpj ?? null);
    const endereco = selectedClient?.endereco?.trim() || first?.emitente?.endereco || "—";
    const contato = selectedClient?.contato?.trim() || "—";
    const responsavel = selectedClient?.responsavel?.trim() || "—";
    const mes = getMonthLabel(exportSource);
    return { empresa, cnpj, endereco, contato, responsavel, mes };
  };

  const exportCsv = () => {
    const { empresa, cnpj, endereco, contato, responsavel, mes } = getExportHeader();
    const totalVal = exportSource.reduce((a, r) => a + r.valorTotal, 0);
    const rows = exportSource.map((r) => ({
      Data: formatDate(r.dataEmissao),
      "Chave de acesso": r.chave,
      "NF-e/NFC-e": r.numero,
      Valor: formatCurrency(r.valorTotal),
      "Discriminação dos itens": summarizeItems(r.itens),
      Status: r.status,
    }));
    const headers = Object.keys(rows[0] ?? {});
    const headerBlock = [
      `EMPRESA;${empresa}`,
      `CNPJ;${cnpj}`,
      `ENDEREÇO;${endereco}`,
      `CONTATO;${contato}`,
      `RESPONSÁVEL;${responsavel}`,
      `MÊS;${mes.toUpperCase()}`,
      "",
    ].join("\n");
    const tableRows = [headers.join(";"), ...rows.map((row) => headers.map((h) => `"${String(row[h as keyof typeof row] ?? "").replace(/"/g, '""')}"`).join(";"))];
    const totalBlock = [
      "",
      `VALOR TOTAL DA VENDA DO MÊS: ${mes.toUpperCase()};${formatCurrency(totalVal)}`,
    ].join("\n");
    const csv = [headerBlock, ...tableRows, totalBlock].join("\n");
    downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" }), "prestacao-contas.csv");
  };

  const exportXlsx = () => {
    const { empresa, cnpj, endereco, contato, responsavel, mes } = getExportHeader();
    const totalVal = exportSource.reduce((a, r) => a + r.valorTotal, 0);
    const rows = exportSource.map((r) => ({
      Data: formatDate(r.dataEmissao),
      "Chave de acesso": r.chave,
      "NF-e/NFC-e": r.numero,
      Valor: r.valorTotal,
      "Discriminação dos itens": summarizeItems(r.itens),
      Status: r.status,
    }));
    const headerData = [
      ["EMPRESA", empresa],
      ["CNPJ", cnpj],
      ["ENDEREÇO", endereco],
      ["CONTATO", contato],
      ["RESPONSÁVEL", responsavel],
      ["MÊS", mes.toUpperCase()],
      [],
      ["Data", "Chave de acesso", "NF-e/NFC-e", "Valor", "Discriminação dos itens", "Status"],
    ];
    const dataRows = rows.map((r) => [r.Data, r["Chave de acesso"], r["NF-e/NFC-e"], r.Valor, r["Discriminação dos itens"], r.Status]);
    const totalRow = [["VALOR TOTAL DA VENDA DO MÊS: " + mes.toUpperCase(), formatCurrency(totalVal), "", "", "", ""]];
    const allData = [...headerData, ...dataRows, ...totalRow];
    const ws = XLSX.utils.aoa_to_sheet(allData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prestacao");
    downloadBlob(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "prestacao-contas.xlsx");
  };

  const exportPdf = () => {
    const { empresa, cnpj, endereco, contato, responsavel, mes } = getExportHeader();
    const totalVal = exportSource.reduce((a, r) => a + r.valorTotal, 0);
    const rows = exportSource.map((r) => ({ data: formatDate(r.dataEmissao), chave: r.chave, numero: r.numero, valor: formatCurrency(r.valorTotal), itens: summarizeItems(r.itens) }));
    const escapeHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const headerHtml = `
      <div style="margin-bottom:20px;font-size:12px;line-height:1.6">
        <p><strong>EMPRESA:</strong> ${escapeHtml(empresa)}</p>
        <p><strong>CNPJ:</strong> ${escapeHtml(cnpj)}</p>
        <p><strong>ENDEREÇO:</strong> ${escapeHtml(endereco)}</p>
        <p><strong>CONTATO:</strong> ${escapeHtml(contato)}</p>
        <p><strong>RESPONSÁVEL:</strong> ${escapeHtml(responsavel)}</p>
        <p><strong>MÊS:</strong> ${escapeHtml(mes.toUpperCase())}</p>
      </div>
      <hr style="border:1px solid #ddd;margin:12px 0" />
    `;
    const totalHtml = `
      <hr style="border:1px solid #ddd;margin:16px 0" />
      <p style="background:#e5e5e5;padding:10px;font-weight:bold;margin:0">
        VALOR TOTAL DA VENDA DO MÊS: ${escapeHtml(mes.toUpperCase())} — ${escapeHtml(formatCurrency(totalVal))}
      </p>
    `;
    const html = `<!DOCTYPE html><html><head><title>Prestação de contas</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f2f2f2}</style></head><body><h1>Prestação de contas - notas fiscais</h1>${headerHtml}<table><thead><tr><th>Data</th><th>Chave de acesso</th><th>NF-e/NFC-e</th><th>Valor</th><th>Discriminação dos itens</th><th>Status</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r.data)}</td><td>${escapeHtml(r.chave)}</td><td>${escapeHtml(r.numero)}</td><td>${escapeHtml(r.valor)}</td><td>${escapeHtml(r.itens)}</td><td>Autorizada</td></tr>`).join("")}</tbody></table>${totalHtml}</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  if (!selectedClient) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold text-slate-900">Documentos fiscais</h1>
        <p className="mt-1 text-slate-600">Upload, edição e exportação de notas fiscais (NF-e)</p>
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-600">Selecione um cliente</p>
          <p className="mt-1 text-sm text-slate-500">Escolha uma empresa no seletor para gerenciar as notas</p>
          <div className="mt-6">
            <ClientSelector />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      {(uploading || uploadProgress) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Loader2 className="size-6 animate-spin text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">Importando notas</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">
                  {uploadProgress ? `${uploadProgress.sent} de ${uploadProgress.total}` : "..."}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {uploadProgress
                    ? `Enviadas ${uploadProgress.sent.toLocaleString("pt-BR")} de ${uploadProgress.total.toLocaleString("pt-BR")} notas`
                    : "Processando arquivos..."}
                </p>
                {uploadProgress && uploadProgress.total > 0 && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.round((uploadProgress.sent / uploadProgress.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-sm text-slate-500">Empresa: {selectedClient?.name ?? "—"}</p>
              <h1 className="text-2xl font-semibold tracking-tight">Documentos fiscais</h1>
            </div>
            <ClientSelector />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-2" disabled={uploading} asChild>
              <label className="cursor-pointer">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UploadCloud className="size-4" />
                )}
                {uploading ? "Importando..." : "Upload XML"}
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".xml,.XML,.zip"
                  disabled={uploading}
                  onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }}
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setHeaderModalOpen(true)}
            >
              <FileEdit className="size-4" />
              Editar cabeçalho
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2" disabled={filteredRecords.length === 0}>
                  Exportar
                  <ArrowUpRight className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportXlsx}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportCsv}>CSV (.csv)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportPdf}>PDF (prestação)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <section className="px-6 py-6">
        <StatsCards metrics={metrics} />
        <Tabs defaultValue="notas" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="notas">Notas</TabsTrigger>
              <TabsTrigger value="prestacao">Prestação de contas</TabsTrigger>
              <TabsTrigger value="alertas">Alertas fiscais</TabsTrigger>
            </TabsList>
            <TopbarSearch value={query} onChange={setQuery} />
          </div>
          <TabsContent value="notas" className="mt-6">
            <NotesTable
              records={filteredRecords}
              includedMap={includedMap}
              onToggleIncluded={(chave, v) => setIncludedMap((p) => ({ ...p, [chave]: v }))}
              onSelectRecord={setSelectedRecord}
              companies={companies}
              productIds={productIds}
              descriptions={descriptions}
              cests={cests}
              allSelected={allSelected}
              onToggleAll={(v) => setIncludedMap((p) => { const n = { ...p }; filteredRecords.forEach((r) => { n[r.chave] = v; }); return n; })}
              filters={{ status: statusFilter, company: companyFilter, productIds: productIdsFilter, descriptions: descriptionsFilter, cests: cestsFilter, minValue, maxValue, month: selectedMonth } as NotesTableFilters}
              onFiltersChange={{ setStatus: setStatusFilter, setCompany: setCompanyFilter, setProductIds: setProductIdsFilter, setDescriptions: setDescriptionsFilter, setCests: setCestsFilter, setMinValue, setMaxValue, setMonth: setSelectedMonth } as NotesTableFilterHandlers}
              monthOptions={monthOptions}
              onDeleteMonth={
                selectedMonth
                  ? async () => {
                      const monthLabel = monthOptions.find((o) => o.value === selectedMonth)?.label ?? selectedMonth;
                      const confirmed = await confirm({
                        title: "Excluir notas do mês",
                        description: `Excluir todas as notas de ${monthLabel}? Esta ação não pode ser desfeita.`,
                        confirmLabel: "Excluir",
                        variant: "destructive",
                      });
                      if (!confirmed) return;
                      setDeleteMonthLoading(true);
                      try {
                        const count = await deleteByMonth(selectedMonth);
                        toast.success(count > 0 ? `${count} nota(s) excluída(s).` : "Nenhuma nota encontrada para este mês.");
                      } finally {
                        setDeleteMonthLoading(false);
                      }
                    }
                  : undefined
              }
              deleteMonthLoading={deleteMonthLoading}
              loading={notesLoading}
            />
          </TabsContent>
          <TabsContent value="prestacao" className="mt-6">
            <PrestacaoPanel records={monthFilteredRecords} metrics={metrics} onExportCsv={exportCsv} onExportPdf={exportPdf} onExportXlsx={exportXlsx} />
          </TabsContent>
          <TabsContent value="alertas" className="mt-6">
            <AlertsPanel records={monthFilteredRecords} metrics={metrics} />
          </TabsContent>
        </Tabs>
      </section>

      <NoteDetailsDialog
        record={selectedRecord}
        open={Boolean(selectedRecord)}
        onOpenChange={(open) => !open && setSelectedRecord(null)}
        onSave={updateRecord}
        onDelete={deleteRecord}
      />
      <HeaderEditModal
        client={selectedClient}
        open={headerModalOpen}
        onOpenChange={setHeaderModalOpen}
        onSaved={refetch}
      />
    </div>
  );
}
