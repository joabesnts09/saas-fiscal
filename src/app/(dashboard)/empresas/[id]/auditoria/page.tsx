"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  FileEdit,
  FileText,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ClientSelector from "@/components/client-selector";
import { useClient } from "@/contexts/client-context";
import { getAuthHeaders } from "@/lib/auth-client";
import { formatCnpj, formatCurrency, formatDate, parseNfeXml, type NfeRecord } from "@/lib/nfe";
import { DEFAULT_EXPORT_FIELDS, getRecordRowsByItem, getRecordRowsByItemFormatted, type ExportFieldKey } from "@/lib/export-config";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/components/confirm-dialog";
import HeaderEditModal from "@/components/dashboard/header-edit-modal";
import EditExportModal from "@/components/dashboard/edit-export-modal";
import { useNotes } from "@/contexts/notes-context";
import AuditoriaCharts from "@/components/auditoria/auditoria-charts";
import AuditoriaItemsTable from "@/components/auditoria/auditoria-items-table";
import AuditoriaSkeletons from "@/components/auditoria/auditoria-skeletons";

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

function getYearsFromRecords(records: NfeRecord[]): { value: string; label: string }[] {
  const yearSet = new Set<string>();
  for (const r of records) {
    const d = r.dataEmissao?.trim();
    if (!d || d.length < 4) continue;
    const yyyy = d.slice(0, 4);
    if (/^\d{4}$/.test(yyyy)) yearSet.add(yyyy);
  }
  return Array.from(yearSet)
    .sort((a, b) => b.localeCompare(a))
    .map((value) => ({ value, label: value }));
}

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

type FiscalAlertRow = {
  id: string;
  chave: string;
  itemIndex: number | null;
  productId: string | null;
  tipo: string;
  notaTipo: string | null;
  descricao: string;
  nivel: string;
  detalhes: string | null;
  createdAt: string;
};

const TIPO_LABEL: Record<string, string> = {
  divergencia_icms: "Divergência de ICMS",
  ncm_invalido: "NCM inválido",
  cest_obrigatorio: "CEST obrigatório",
  cst_icms_incompativel: "CST/ICMS incompatível",
  bebida_icms_zerado: "Bebida com ICMS zerado",
  cfop_invalido: "CFOP inválido",
  cfop_incompativel: "CFOP incompatível",
  pis_cofins_zerado: "PIS/COFINS zerado",
};

function getTipoLabel(tipo: string): string {
  return TIPO_LABEL[tipo] ?? tipo;
}

function calculateScore(alerts: FiscalAlertRow[]): number {
  let score = 100;
  for (const a of alerts) {
    if (a.nivel === "error") score -= 10;
    else if (a.nivel === "warning") score -= 3;
    else if (a.nivel === "info") score -= 1;
  }
  return Math.max(0, Math.min(100, score));
}

export default function AuditoriaFiscalPage() {
  const params = useParams();
  const clientId = params?.id as string | undefined;
  const { clients, selectedClient, refetch } = useClient();
  const client = selectedClient ?? clients.find((c) => c.id === clientId) ?? null;
  const { addRecords, uploadProgress, deleteByMonth } = useNotes();
  const { confirm } = useConfirm();

  const [headerModalOpen, setHeaderModalOpen] = useState(false);
  const [exportConfigModalOpen, setExportConfigModalOpen] = useState(false);
  const [exportFields, setExportFields] = useState<ExportFieldKey[]>(() => [...DEFAULT_EXPORT_FIELDS]);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState<NfeRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [alerts, setAlerts] = useState<FiscalAlertRow[]>([]);
  const [stats, setStats] = useState<{
    notesCount: number;
    vendaCount?: number;
    compraCount?: number;
    itemsCount: number;
    itemsWithFiscalData: number;
    totalICMS: number;
    totalPIS: number;
    totalCOFINS: number;
    topCfops: { cfop: string; count: number }[];
    topNcms: { ncm: string; count: number }[];
    icmsByMonth: { mes: string; valor: number }[];
    hasFiscalData: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [deleteMonthLoading, setDeleteMonthLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [nivelFilter, setNivelFilter] = useState<string>("all");
  const [notaTipoFilter, setNotaTipoFilter] = useState<string>("all");

  const fetchNotes = useCallback(async () => {
    if (!clientId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(Array.isArray(data) ? data : []);
      } else {
        setNotes([]);
      }
    } catch {
      setNotes([]);
    }
  }, [clientId]);

  const fetchStats = useCallback(async () => {
    if (!clientId) return;
    try {
      const url = new URL(`/api/clients/${clientId}/fiscal-stats`, window.location.origin);
      if (selectedMonth) url.searchParams.set("mes", selectedMonth);
      else if (selectedYear) url.searchParams.set("ano", selectedYear);
      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        setStats(null);
      }
    } catch {
      setStats(null);
    }
  }, [clientId, selectedYear, selectedMonth]);

  const fetchAlerts = useCallback(async () => {
    if (!clientId) return;
    try {
      const url = new URL(`/api/clients/${clientId}/fiscal-alerts`, window.location.origin);
      if (notaTipoFilter !== "all") url.searchParams.set("notaTipo", notaTipoFilter);
      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar alertas");
      const data = await res.json();
      setAlerts(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar alertas fiscais");
      setAlerts([]);
    }
  }, [clientId, notaTipoFilter]);

  const handleReanalisar = async () => {
    if (!clientId) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/fiscal-alerts`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao analisar");
      const data = await res.json();
      toast.success(`${data.analyzed} notas analisadas. ${data.alertsCount} alertas encontrados.`);
      await Promise.all([fetchNotes(), fetchAlerts(), fetchStats()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reanalisar");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || !selectedClient?.id) return;
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
        } else if (file.name.toLowerCase().endsWith(".xml")) {
          const text = await file.text();
          const r = parseNfeXml(text);
          if (r?.chave) parsed.push(r);
        }
      }
      if (parsed.length > 0) {
        await addRecords(parsed);
        await Promise.all([fetchNotes(), fetchAlerts(), fetchStats()]);
        toast.success(`${parsed.length} nota(s) importada(s).`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar");
    } finally {
      setUploading(false);
    }
  };

  const yearOptions = useMemo(() => getYearsFromRecords(notes), [notes]);
  const yearFilteredNotes = useMemo(() => {
    if (!selectedYear) return notes;
    return notes.filter((r) => {
      const d = r.dataEmissao?.trim() ?? "";
      return d.length >= 4 && d.startsWith(selectedYear);
    });
  }, [notes, selectedYear]);

  const monthOptions = useMemo(() => getMonthsFromRecords(yearFilteredNotes), [yearFilteredNotes]);
  const monthFilteredNotes = useMemo(() => {
    if (!selectedMonth) return yearFilteredNotes;
    return yearFilteredNotes.filter((r) => {
      const d = r.dataEmissao?.trim() ?? "";
      return d.length >= 7 && d.startsWith(selectedMonth);
    });
  }, [yearFilteredNotes, selectedMonth]);

  const fetchExportConfig = useCallback(async () => {
    if (!clientId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/export-config`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.fields) && data.fields.length > 0) {
          setExportFields(data.fields);
        }
      }
    } catch {
      /* ignore */
    }
  }, [clientId]);

  useEffect(() => {
    fetchExportConfig();
  }, [fetchExportConfig]);

  useEffect(() => {
    if (yearOptions.length > 0 && !yearOptions.some((o) => o.value === selectedYear)) {
      setSelectedYear(yearOptions[0]!.value);
    } else if (yearOptions.length === 0) {
      setSelectedYear("");
    }
  }, [yearOptions, selectedYear]);

  useEffect(() => {
    if (monthOptions.length > 0 && !monthOptions.some((o) => o.value === selectedMonth)) {
      setSelectedMonth(monthOptions[0]!.value);
    } else if (monthOptions.length === 0) {
      setSelectedMonth("");
    }
  }, [monthOptions, selectedMonth]);

  const displayNotes = selectedMonth ? monthFilteredNotes : yearFilteredNotes;
  const getExportHeader = (source: NfeRecord[]) => ({
    empresa: client?.name ?? "—",
    cnpj: formatCnpj(client?.cnpj ?? null),
    endereco: client?.endereco?.trim() || "—",
    contato: client?.contato?.trim() || "—",
    responsavel: client?.responsavel?.trim() || "—",
    periodo: selectedMonth ? (monthOptions.find((o) => o.value === selectedMonth)?.label ?? selectedMonth) : (selectedYear ?? ""),
  });

  const exportCsv = () => {
    const exportSource = displayNotes;
    const { empresa, cnpj, endereco, contato, responsavel, periodo } = getExportHeader(exportSource);
    const totalVal = exportSource.reduce((a, r) => a + r.valorTotal, 0);
    const rows = exportSource.flatMap((r) => getRecordRowsByItemFormatted(r, exportFields, client?.cnpj));
    const headers = Object.keys(rows[0] ?? {});
    const headerBlock = [
      `EMPRESA;${empresa}`,
      `CNPJ;${cnpj}`,
      `ENDEREÇO;${endereco}`,
      `CONTATO;${contato}`,
      `RESPONSÁVEL;${responsavel}`,
      `PERÍODO;${periodo}`,
      "",
    ].join("\n");
    const tableRows = [headers.join(";"), ...rows.map((row) => headers.map((h) => `"${String(row[h as keyof typeof row] ?? "").replace(/"/g, '""')}"`).join(";"))];
    const totalBlock = ["", `VALOR TOTAL: ${periodo};${formatCurrency(totalVal)}`].join("\n");
    downloadBlob(new Blob(["\ufeff", [headerBlock, ...tableRows, totalBlock].join("\n")], { type: "text/csv;charset=utf-8;" }), "notas-auditoria.csv");
  };

  const exportXlsx = () => {
    const exportSource = displayNotes;
    const { empresa, cnpj, endereco, contato, responsavel, periodo } = getExportHeader(exportSource);
    const totalVal = exportSource.reduce((a, r) => a + r.valorTotal, 0);
    const rows = exportSource.flatMap((r) => getRecordRowsByItem(r, exportFields, client?.cnpj));
    const headers = Object.keys(rows[0] ?? {});
    const headerData = [
      ["EMPRESA", empresa],
      ["CNPJ", cnpj],
      ["ENDEREÇO", endereco],
      ["CONTATO", contato],
      ["RESPONSÁVEL", responsavel],
      ["PERÍODO", periodo],
      [],
      headers,
    ];
    const dataRows = rows.map((r) => headers.map((h) => r[h] ?? ""));
    const totalRow = [[`VALOR TOTAL: ${periodo}`, formatCurrency(totalVal), ...Array(Math.max(0, headers.length - 2)).fill("")] as (string | number)[]];
    const ws = XLSX.utils.aoa_to_sheet([...headerData, ...dataRows, ...totalRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notas");
    downloadBlob(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "notas-auditoria.xlsx");
  };

  const exportPdf = () => {
    const exportSource = displayNotes;
    const { empresa, cnpj, endereco, contato, responsavel, periodo } = getExportHeader(exportSource);
    const totalVal = exportSource.reduce((a, r) => a + r.valorTotal, 0);
    const rows = exportSource.flatMap((r) => getRecordRowsByItemFormatted(r, exportFields, client?.cnpj));
    const headers = Object.keys(rows[0] ?? {});
    const escapeHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const headerHtml = `<div style="margin-bottom:20px;font-size:12px;line-height:1.6"><p><strong>EMPRESA:</strong> ${escapeHtml(empresa)}</p><p><strong>CNPJ:</strong> ${escapeHtml(cnpj)}</p><p><strong>ENDEREÇO:</strong> ${escapeHtml(endereco)}</p><p><strong>CONTATO:</strong> ${escapeHtml(contato)}</p><p><strong>RESPONSÁVEL:</strong> ${escapeHtml(responsavel)}</p><p><strong>PERÍODO:</strong> ${escapeHtml(periodo)}</p></div><hr style="border:1px solid #ddd;margin:12px 0" />`;
    const totalHtml = `<hr style="border:1px solid #ddd;margin:16px 0" /><p style="background:#e5e5e5;padding:10px;font-weight:bold;margin:0">VALOR TOTAL: ${escapeHtml(periodo)} — ${escapeHtml(formatCurrency(totalVal))}</p>`;
    const thCells = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const bodyRows = rows.map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml(String(r[h] ?? "")).replace(/\n/g, "<br />")}</td>`).join("")}</tr>`).join("");
    const html = `<!DOCTYPE html><html><head><title>Notas - Auditoria</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f2f2f2}</style></head><body><h1>Notas fiscais - Auditoria</h1>${headerHtml}<table><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table>${totalHtml}</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const handleExportFiltered = useCallback(
    (filteredRecords: NfeRecord[], format: "csv" | "xlsx" | "pdf") => {
      if (filteredRecords.length === 0) {
        toast.error("Nenhum item para exportar.");
        return;
      }
      const periodo = selectedMonth ? (monthOptions.find((o) => o.value === selectedMonth)?.label ?? selectedMonth) : (selectedYear ?? "");
      const rows = filteredRecords.flatMap((r) => getRecordRowsByItemFormatted(r, exportFields, client?.cnpj));
      const totalVal = filteredRecords.reduce((a, r) => a + r.itens.reduce((s, i) => s + (i.vProd ?? 0), 0), 0);
      const headerBase = {
        empresa: client?.name ?? "—",
        cnpj: formatCnpj(client?.cnpj ?? null),
        endereco: client?.endereco?.trim() || "—",
        contato: client?.contato?.trim() || "—",
        responsavel: client?.responsavel?.trim() || "—",
        periodo: `Busca: ${periodo}`,
      };
      const rowsRaw = filteredRecords.flatMap((r) => getRecordRowsByItem(r, exportFields, client?.cnpj));
      const headers = Object.keys(rows[0] ?? {});
      if (format === "csv") {
        const headerBlock = [
          `EMPRESA;${headerBase.empresa}`,
          `CNPJ;${headerBase.cnpj}`,
          `ENDEREÇO;${headerBase.endereco}`,
          `CONTATO;${headerBase.contato}`,
          `RESPONSÁVEL;${headerBase.responsavel}`,
          `PERÍODO;${headerBase.periodo}`,
          "",
        ].join("\n");
        const tableRows = [headers.join(";"), ...rows.map((row) => headers.map((h) => `"${String(row[h as keyof typeof row] ?? "").replace(/"/g, '""')}"`).join(";"))];
        const totalBlock = ["", `VALOR TOTAL (itens da busca): ${formatCurrency(totalVal)}`].join("\n");
        downloadBlob(new Blob(["\ufeff", [headerBlock, ...tableRows, totalBlock].join("\n")], { type: "text/csv;charset=utf-8;" }), "notas-auditoria-busca.csv");
      } else if (format === "xlsx") {
        const headerData = [
          ["EMPRESA", headerBase.empresa],
          ["CNPJ", headerBase.cnpj],
          ["ENDEREÇO", headerBase.endereco],
          ["CONTATO", headerBase.contato],
          ["RESPONSÁVEL", headerBase.responsavel],
          ["PERÍODO", headerBase.periodo],
          [],
          headers,
        ];
        const dataRows = rowsRaw.map((r) => headers.map((h) => r[h] ?? ""));
        const totalRow = [[`VALOR TOTAL (itens da busca)`, formatCurrency(totalVal), ...Array(Math.max(0, headers.length - 2)).fill("")] as (string | number)[]];
        const ws = XLSX.utils.aoa_to_sheet([...headerData, ...dataRows, ...totalRow]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Busca");
        downloadBlob(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "notas-auditoria-busca.xlsx");
      } else {
        const escapeHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const headerHtml = `<div style="margin-bottom:20px;font-size:12px;line-height:1.6"><p><strong>EMPRESA:</strong> ${escapeHtml(headerBase.empresa)}</p><p><strong>CNPJ:</strong> ${escapeHtml(headerBase.cnpj)}</p><p><strong>ENDEREÇO:</strong> ${escapeHtml(headerBase.endereco)}</p><p><strong>CONTATO:</strong> ${escapeHtml(headerBase.contato)}</p><p><strong>RESPONSÁVEL:</strong> ${escapeHtml(headerBase.responsavel)}</p><p><strong>PERÍODO:</strong> ${escapeHtml(headerBase.periodo)}</p></div><hr style="border:1px solid #ddd;margin:12px 0" />`;
        const totalHtml = `<hr style="border:1px solid #ddd;margin:16px 0" /><p style="background:#e5e5e5;padding:10px;font-weight:bold;margin:0">VALOR TOTAL (itens da busca): ${escapeHtml(formatCurrency(totalVal))}</p>`;
        const thCells = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
        const bodyRows = rows.map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml(String(r[h] ?? "")).replace(/\n/g, "<br />")}</td>`).join("")}</tr>`).join("");
        const html = `<!DOCTYPE html><html><head><title>Notas - Busca</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f2f2f2}</style></head><body><h1>Notas fiscais - Resultados da busca</h1>${headerHtml}<table><thead><tr>${thCells}</tr></thead><tbody>${bodyRows}</tbody></table>${totalHtml}</body></html>`;
        const w = window.open("", "_blank");
        if (!w) return;
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
      }
      toast.success(`Exportado: ${filteredRecords.length} nota(s), ${rows.length} item(ns).`);
    },
    [client, selectedMonth, selectedYear, monthOptions, exportFields]
  );

  const handleDeleteMonth = useCallback(async () => {
    if (!selectedMonth) return;
    const monthLabel = monthOptions.find((o) => o.value === selectedMonth)?.label ?? selectedMonth;
    const confirmed = await confirm({
      title: "Excluir notas do mês",
      description: `Excluir todas as notas de ${monthLabel}? Você poderá fazer o upload dos XMLs novamente. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!confirmed) return;
    setDeleteMonthLoading(true);
    try {
      const count = await deleteByMonth(selectedMonth);
      await fetchNotes();
      await fetchAlerts();
      await fetchStats();
      toast.success(count > 0 ? `${count} nota(s) excluída(s). Faça o upload dos XMLs novamente.` : "Nenhuma nota encontrada para este mês.");
    } catch (e) {
      toast.error("Erro ao excluir notas.");
      console.error(e);
    } finally {
      setDeleteMonthLoading(false);
    }
  }, [selectedMonth, monthOptions, confirm, deleteByMonth, fetchNotes, fetchAlerts, fetchStats]);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    Promise.all([fetchNotes(), fetchAlerts()]).finally(() => setLoading(false));
  }, [clientId, fetchNotes, fetchAlerts]);

  useEffect(() => {
    if (!clientId) return;
    fetchStats();
  }, [clientId, selectedYear, selectedMonth, fetchStats]);

  const alertsForDisplay = useMemo(() => {
    const source = selectedMonth ? monthFilteredNotes : yearFilteredNotes;
    const chaves = new Set(source.map((r) => r.chave));
    return alerts.filter((a) => chaves.has(a.chave));
  }, [alerts, selectedMonth, monthFilteredNotes, yearFilteredNotes]);

  const filteredAlerts =
    nivelFilter === "all"
      ? alerts
      : alerts.filter((a) => a.nivel === nivelFilter);

  const errorCount = alerts.filter((a) => a.nivel === "error").length;
  const warningCount = alerts.filter((a) => a.nivel === "warning").length;
  const infoCount = alerts.filter((a) => a.nivel === "info").length;
  const score = calculateScore(alerts);

  if (!clientId) {
    return (
      <div className="min-h-full bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Empresa: —</p>
              <h1 className="text-2xl font-semibold tracking-tight">Auditoria fiscal</h1>
            </div>
            <ClientSelector />
          </div>
        </header>
        <section className="px-6 py-6">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-slate-600">Selecione uma empresa para ver a auditoria.</p>
            <p className="mt-1 text-sm text-slate-500">Escolha uma empresa no seletor acima</p>
          </div>
        </section>
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
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-sm text-slate-500">Empresa: {client?.name ?? "—"}</p>
              <h1 className="text-2xl font-semibold tracking-tight">Auditoria fiscal</h1>
            </div>
            <ClientSelector />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-2" disabled={uploading} asChild>
              <label className="cursor-pointer">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
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
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setHeaderModalOpen(true)}>
              <FileEdit className="size-4" />
              Editar cabeçalho
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setExportConfigModalOpen(true)}
            >
              <Settings2 className="size-4" />
              Editar exportação
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2" disabled={displayNotes.length === 0}>
                  Exportar
                  <ArrowUpRight className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportXlsx}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportCsv}>CSV (.csv)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportPdf}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={handleReanalisar}
              disabled={analyzing}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 gap-2"
            >
              {analyzing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Reanalisar notas
            </Button>
          </div>
        </div>
      </header>

      <section className="px-6 py-6">
        {loading ? (
          <AuditoriaSkeletons />
        ) : (
          <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Score fiscal
                </CardTitle>
                <div
                  className={`flex size-9 items-center justify-center rounded-full ${
                    score >= 80 ? "bg-emerald-100 text-emerald-600" : score >= 50 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                  }`}
                >
                  <ShieldCheck className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{score}/100</p>
                <p className="mt-1 text-xs text-slate-500">
                  {score >= 80 ? "Bom" : score >= 50 ? "Atenção" : "Requer correções"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Erros
                </CardTitle>
                <div className="flex size-9 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <AlertCircle className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{errorCount}</p>
                <p className="mt-1 text-xs text-slate-500">Críticos</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Avisos
                </CardTitle>
                <div className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertTriangle className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{warningCount}</p>
                <p className="mt-1 text-xs text-slate-500">Verificar</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Informações
                </CardTitle>
                <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <CheckCircle2 className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{infoCount}</p>
                <p className="mt-1 text-xs text-slate-500">Observações</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{alerts.length}</p>
                <p className="mt-1 text-xs text-slate-500">Alertas detectados</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="resumo" className="mb-6">
            <TabsList className="mb-4">
              <TabsTrigger value="resumo">Resumo e análise</TabsTrigger>
              <TabsTrigger value="itens">Análise por itens</TabsTrigger>
              <TabsTrigger value="inconsistencias">Inconsistências</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-6">
              {yearOptions.length > 0 && (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-500">Ano</Label>
                    <Select value={selectedYear || yearOptions[0]?.value} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Selecione o ano" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {monthOptions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-500">Mês (tabela e exclusão)</Label>
                      <Select value={selectedMonth || monthOptions[0]?.value} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecione o mês" />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
              {stats && (
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="size-5" />
                      Resumo da análise
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      {stats.notesCount > 0
                        ? `Dados extraídos de ${stats.notesCount} nota(s) (${stats.vendaCount ?? stats.notesCount} venda, ${stats.compraCount ?? 0} compra) e ${stats.itemsCount} item(ns)`
                        : "Nenhuma nota importada. Importe XMLs em Documentos fiscais para iniciar a análise."}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {stats.notesCount === 0 ? (
                      <p className="text-sm text-slate-600">
                        Importe XMLs de notas fiscais em Documentos fiscais para ter dados para análise.
                      </p>
                    ) : (
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                          <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <FileText className="size-5" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Notas analisadas</p>
                            <p className="text-xl font-semibold text-slate-900">{stats.notesCount}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                          <div>
                            <p className="text-xs text-slate-500">Itens analisados</p>
                            <p className="text-xl font-semibold text-slate-900">{stats.itemsCount}</p>
                          </div>
                        </div>
                        {stats.hasFiscalData && (
                          <>
                            <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                <TrendingUp className="size-5" />
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">ICMS total</p>
                                <p className="text-xl font-semibold text-slate-900">{formatCurrency(stats.totalICMS)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                              <div>
                                <p className="text-xs text-slate-500">PIS + COFINS</p>
                                <p className="text-xl font-semibold text-slate-900">{formatCurrency(stats.totalPIS + stats.totalCOFINS)}</p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {!stats.hasFiscalData && stats.notesCount > 0 && stats.itemsCount > 0 ? (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                        <p className="text-sm text-amber-800">
                          As notas foram importadas antes da análise fiscal. Para habilitar a auditoria completa (ICMS, PIS, COFINS, NCM, CFOP),
                          reimporte os XMLs em Documentos fiscais.
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )}
              <AuditoriaCharts stats={stats ? { totalICMS: stats.totalICMS, totalPIS: stats.totalPIS, totalCOFINS: stats.totalCOFINS, topCfops: stats.topCfops ?? [], topNcms: stats.topNcms ?? [], icmsByMonth: stats.icmsByMonth ?? [] } : null} />
              <AuditoriaItemsTable
                records={displayNotes}
                alerts={alertsForDisplay}
                onDeleteMonth={selectedMonth ? handleDeleteMonth : undefined}
                deleteMonthLoading={deleteMonthLoading}
                deleteMonthDisabled={!selectedMonth || monthFilteredNotes.length === 0}
                onExportFiltered={handleExportFiltered}
                clientCnpj={client?.cnpj}
              />
            </TabsContent>

            <TabsContent value="itens" className="space-y-6">
              {yearOptions.length > 0 && (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-500">Ano</Label>
                    <Select value={selectedYear || yearOptions[0]?.value} onValueChange={setSelectedYear}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Selecione o ano" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {monthOptions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-500">Mês</Label>
                      <Select value={selectedMonth || monthOptions[0]?.value} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecione o mês" />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
              <AuditoriaItemsTable
                records={displayNotes}
                alerts={alertsForDisplay}
                onDeleteMonth={selectedMonth ? handleDeleteMonth : undefined}
                deleteMonthLoading={deleteMonthLoading}
                deleteMonthDisabled={!selectedMonth || monthFilteredNotes.length === 0}
                onExportFiltered={handleExportFiltered}
                clientCnpj={client?.cnpj}
              />
            </TabsContent>

            <TabsContent value="inconsistencias">
              <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Inconsistências detectadas</CardTitle>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500 self-center">Nota:</span>
                {(["all", "venda", "compra"] as const).map((n) => (
                  <Button
                    key={n}
                    variant={notaTipoFilter === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNotaTipoFilter(n)}
                  >
                    {n === "all" ? "Todas" : n === "venda" ? "Venda" : "Compra"}
                  </Button>
                ))}
                <span className="w-2" />
                {(["all", "error", "warning", "info"] as const).map((n) => (
                  <Button
                    key={n}
                    variant={nivelFilter === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNivelFilter(n)}
                  >
                    {n === "all" ? "Todos" : n === "error" ? "Erros" : n === "warning" ? "Avisos" : "Info"}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {filteredAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShieldCheck className="mb-4 size-12 text-emerald-500" />
                  <p className="font-medium text-slate-700">Nenhuma inconsistência encontrada</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {alerts.length === 0
                      ? "Clique em &quot;Reanalisar notas&quot; para executar a auditoria nas notas importadas."
                      : "Nenhum alerta corresponde ao filtro selecionado."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operação</TableHead>
                        <TableHead>Chave</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Nível</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAlerts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                a.notaTipo === "compra"
                                  ? "border-blue-300 bg-blue-50 text-blue-700"
                                  : a.notaTipo === "venda"
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-slate-50 text-slate-600"
                              }
                            >
                              {a.notaTipo === "compra" ? "Compra" : a.notaTipo === "venda" ? "Venda" : "Outro"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-600">
                            {a.chave.slice(0, 20)}...
                          </TableCell>
                          <TableCell>
                            {a.itemIndex != null ? `#${a.itemIndex + 1}` : "-"}
                            {a.productId && (
                              <span className="ml-1 text-slate-500">({a.productId})</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{getTipoLabel(a.tipo)}</TableCell>
                          <TableCell className="min-w-[280px] max-w-[480px] text-sm text-slate-700">
                            {a.descricao}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                a.nivel === "error"
                                  ? "border-rose-300 bg-rose-50 text-rose-700"
                                  : a.nivel === "warning"
                                    ? "border-amber-300 bg-amber-50 text-amber-700"
                                    : "border-blue-300 bg-blue-50 text-blue-700"
                              }
                            >
                              {a.nivel === "error" ? "Erro" : a.nivel === "warning" ? "Aviso" : "Info"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">{formatDate(a.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>
          </>
        )}
      </section>
      {client && (
        <>
          <HeaderEditModal
            client={client}
            open={headerModalOpen}
            onOpenChange={setHeaderModalOpen}
            onSaved={refetch}
          />
          <EditExportModal
            clientId={client.id}
            open={exportConfigModalOpen}
            onOpenChange={setExportConfigModalOpen}
            onSaved={setExportFields}
          />
        </>
      )}
    </div>
  );
}
