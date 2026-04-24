"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
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
import {
  formatCnpj,
  formatCurrency,
  formatDate,
  parseNfeXml,
  recordEnvolveClienteCnpj,
  type NfeRecord,
} from "@/lib/nfe";
const AUDITORIA_TABLE_PER_PAGE = 60;
import { DEFAULT_EXPORT_FIELDS, getRecordRowsByItem, getRecordRowsByItemFormatted, type ExportFieldKey } from "@/lib/export-config";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/components/confirm-dialog";
import HeaderEditModal from "@/components/dashboard/header-edit-modal";
import EditExportModal from "@/components/dashboard/edit-export-modal";
import { useNotes } from "@/contexts/notes-context";
import AuditoriaCharts from "@/components/auditoria/auditoria-charts";
import AuditoriaItemsTable from "@/components/auditoria/auditoria-items-table";
import AuditoriaSkeletons, { ResumoAnalysisSkeleton } from "@/components/auditoria/auditoria-skeletons";
import RelatorioAuditoriaModal, {
  type RelatorioAuditoriaFormData,
  formatRelatorioForCsv,
  relatorioRowsForXlsx,
} from "@/components/auditoria/relatorio-auditoria-modal";
import { generateGraficosPdf, generateNotasPdf, generateRelatorioPdf } from "@/lib/auditoria-export-pdf";
import { captureAuditoriaChartCardPngs } from "@/lib/auditoria-charts-capture";
import { toast as sonnerToast } from "sonner";
import { calculateFiscalScoreFromStored } from "@/lib/fiscal-engine";
import type { ConfazStRow } from "@/lib/confaz-st-core";
import { confazRowsFromApi, type ConfazStApiItem } from "@/lib/confaz-enrichment";

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
  cest_incompativel: "CEST incompatível com NCM (ST)",
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
  return calculateFiscalScoreFromStored(alerts);
}

function alertsForRecords(records: NfeRecord[], alertsList: FiscalAlertRow[]) {
  const chaves = new Set(records.map((r) => r.chave));
  return alertsList.filter((a) => chaves.has(a.chave));
}

function relatorioSummaryForRecords(records: NfeRecord[], alertsList: FiscalAlertRow[]) {
  const a = alertsForRecords(records, alertsList);
  return {
    score: calculateScore(a),
    notasAnalisadas: records.length,
    erros: a.filter((x) => x.nivel === "error").length,
    avisos: a.filter((x) => x.nivel === "warning").length,
  };
}

export default function AuditoriaFiscalPage() {
  const params = useParams();
  const clientId = params?.id as string | undefined;
  const { clients, selectedClient, refetch } = useClient();
  const client = selectedClient ?? clients.find((c) => c.id === clientId) ?? null;
  const { addRecords, uploadProgress, deleteByMonth, deleteByYear, deleteAllNotes } = useNotes();
  const { confirm } = useConfirm();

  const [headerModalOpen, setHeaderModalOpen] = useState(false);
  const [exportConfigModalOpen, setExportConfigModalOpen] = useState(false);
  const [exportFields, setExportFields] = useState<ExportFieldKey[]>(() => [...DEFAULT_EXPORT_FIELDS]);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState<NfeRecord[]>([]);
  const [tableNotes, setTableNotes] = useState<NfeRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [alerts, setAlerts] = useState<FiscalAlertRow[]>([]);
  const [stats, setStats] = useState<{
    operacao?: "todos" | "venda" | "compra";
    notesCount: number;
    vendaCount?: number;
    compraCount?: number;
    itemsCount: number;
    totalItemsValue?: number;
    itemsWithFiscalData: number;
    totalICMS: number;
    totalPIS: number;
    totalCOFINS: number;
    topCfops: { cfop: string; count: number }[];
    topNcms: { ncm: string; count: number }[];
    icmsByMonth: { mes: string; valor: number }[];
    itemsByMonth?: { mes: string; valor: number }[];
    hasFiscalData: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<"month" | "year" | "all" | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [statsOperacao, setStatsOperacao] = useState<"todos" | "venda" | "compra">("todos");
  const [activeTab, setActiveTab] = useState<"tabela" | "graficos" | "inconsistencias">("tabela");
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [tableListMeta, setTableListMeta] = useState<{
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  } | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const tableFetchAbortRef = useRef<AbortController | null>(null);
  const tableFilterKeyRef = useRef<string>("");
  const [statsLoading, setStatsLoading] = useState(true);
  const [nivelFilter, setNivelFilter] = useState<string>("all");
  const [notaTipoFilter, setNotaTipoFilter] = useState<string>("all");
  const [relatorioModalOpen, setRelatorioModalOpen] = useState(false);
  const chartsContainerRef = useRef<HTMLDivElement | null>(null);
  const [pendingExport, setPendingExport] = useState<{
    format: "csv" | "xlsx" | "pdf";
    records: NfeRecord[] | null;
  } | null>(null);
  const [confazStRows, setConfazStRows] = useState<ConfazStRow[]>([]);

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

  const fetchTableNotes = useCallback(async () => {
    if (!clientId) return;
    tableFetchAbortRef.current?.abort();
    const ac = new AbortController();
    tableFetchAbortRef.current = ac;
    setTableLoading(true);
    const filterKey = [clientId, selectedMonth, selectedYear, tableSearchQuery, statsOperacao].join("\0");
    const usePage = tableFilterKeyRef.current === filterKey ? tablePage : 1;
    tableFilterKeyRef.current = filterKey;
    try {
      const url = new URL(`/api/clients/${clientId}/notes`, window.location.origin);
      if (tableSearchQuery.trim().length > 0) url.searchParams.set("q", tableSearchQuery.trim());
      if (selectedMonth) url.searchParams.set("mes", selectedMonth);
      else if (selectedYear) url.searchParams.set("ano", selectedYear);
      url.searchParams.set("operacao", statsOperacao);
      url.searchParams.set("page", String(usePage));
      url.searchParams.set("perPage", String(AUDITORIA_TABLE_PER_PAGE));
      const res = await fetch(url.toString(), {
        signal: ac.signal,
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setTableNotes([]);
        setTableListMeta({ total: 0, page: 1, perPage: AUDITORIA_TABLE_PER_PAGE, totalPages: 1 });
        return;
      }
      const data = await res.json();
      if (ac.signal.aborted) return;
      if (Array.isArray(data)) {
        setTableNotes(data);
        setTablePage(1);
        setTableListMeta({ total: data.length, page: 1, perPage: data.length || AUDITORIA_TABLE_PER_PAGE, totalPages: 1 });
      } else {
        const p = (data as { page?: number }).page ?? 1;
        setTablePage(p);
        setTableNotes((data as { items?: NfeRecord[] }).items ?? []);
        setTableListMeta({
          total: (data as { total?: number }).total ?? 0,
          page: p,
          perPage: (data as { perPage?: number }).perPage ?? AUDITORIA_TABLE_PER_PAGE,
          totalPages: (data as { totalPages?: number }).totalPages ?? 1,
        });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setTableNotes([]);
      setTableListMeta(null);
    } finally {
      if (!ac.signal.aborted) {
        setTableLoading(false);
      }
    }
  }, [clientId, selectedMonth, selectedYear, tableSearchQuery, tablePage, statsOperacao]);

  const fetchAllNotesForTableQuery = useCallback(async (): Promise<NfeRecord[]> => {
    if (!clientId) return [];
    const url = new URL(`/api/clients/${clientId}/notes`, window.location.origin);
    if (tableSearchQuery.trim().length > 0) url.searchParams.set("q", tableSearchQuery.trim());
    if (selectedMonth) url.searchParams.set("mes", selectedMonth);
    else if (selectedYear) url.searchParams.set("ano", selectedYear);
    url.searchParams.set("operacao", statsOperacao);
    const res = await fetch(url.toString(), {
      headers: getAuthHeaders(),
      credentials: "include",
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as { items?: NfeRecord[] }).items)) {
      return (data as { items: NfeRecord[] }).items;
    }
    return [];
  }, [clientId, tableSearchQuery, selectedMonth, selectedYear, statsOperacao]);

  const fetchStats = useCallback(async () => {
    if (!clientId) {
      setStatsLoading(false);
      return;
    }
    setStatsLoading(true);
    try {
      const url = new URL(`/api/clients/${clientId}/fiscal-stats`, window.location.origin);
      if (selectedMonth) url.searchParams.set("mes", selectedMonth);
      else if (selectedYear) url.searchParams.set("ano", selectedYear);
      if (statsOperacao !== "todos") url.searchParams.set("operacao", statsOperacao);
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
    } finally {
      setStatsLoading(false);
    }
  }, [clientId, selectedYear, selectedMonth, statsOperacao]);

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
      await Promise.all([fetchNotes(), fetchTableNotes(), fetchAlerts(), fetchStats()]);
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
      const JSZip = (await import("jszip")).default;
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
      const accepted = parsed.filter((r) => recordEnvolveClienteCnpj(r, client?.cnpj));
      const skipped = parsed.length - accepted.length;
      if (skipped > 0) {
        toast.warning(
          `${skipped} nota(s) ignorada(s): o CNPJ/CPF da empresa cadastrado não consta como emitente nem destinatário.`
        );
      }
      if (accepted.length > 0) {
        await addRecords(accepted);
        await Promise.all([fetchNotes(), fetchTableNotes(), fetchAlerts(), fetchStats()]);
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
  const tableDisplayNotes = useMemo(() => {
    const source = tableNotes;
    if (selectedMonth) {
      return source.filter((r) => (r.dataEmissao?.trim() ?? "").startsWith(selectedMonth));
    }
    if (selectedYear) {
      return source.filter((r) => (r.dataEmissao?.trim() ?? "").startsWith(selectedYear));
    }
    return source;
  }, [tableNotes, selectedMonth, selectedYear]);

  const performAuditoriaExport = useCallback(
    async (
      relatorio: RelatorioAuditoriaFormData,
      format: "csv" | "xlsx" | "pdf",
      exportSource: NfeRecord[],
      filtered: boolean
    ) => {
      if (exportSource.length === 0) {
        toast.error("Nenhuma nota para exportar.");
        return;
      }
      const XLSX = await import("xlsx");
      const periodo = selectedMonth
        ? (monthOptions.find((o) => o.value === selectedMonth)?.label ?? selectedMonth)
        : (selectedYear ?? "");
      const empresa = client?.name ?? "—";
      const cnpj = formatCnpj(client?.cnpj ?? null);
      const endereco = client?.endereco?.trim() || "—";
      const contato = client?.contato?.trim() || "—";
      const responsavel = client?.responsavel?.trim() || "—";
      const totalVal = filtered
        ? exportSource.reduce((a, r) => a + r.itens.reduce((s, i) => s + (i.vProd ?? 0), 0), 0)
        : exportSource.reduce((a, r) => a + r.valorTotal, 0);
      const rowsFmt = exportSource.flatMap((r) => getRecordRowsByItemFormatted(r, exportFields, client?.cnpj));
      const rowsRaw = exportSource.flatMap((r) => getRecordRowsByItem(r, exportFields, client?.cnpj));
      const headers = Object.keys(rowsFmt[0] ?? {});
      const relCsv = formatRelatorioForCsv(relatorio);
      const notesBaseName = filtered ? "notas-auditoria-busca" : "notas-fiscais-auditoria";
      const relBaseName = filtered ? "relatorio-auditoria-busca" : "relatorio-auditoria-fiscal";
      const zipBaseName = filtered ? "auditoria-busca" : "auditoria-fiscal";

      const meta = { empresa, cnpj, endereco, contato, responsavel, periodo, totalVal: formatCurrency(totalVal) };

      if (filtered) {
        if (format === "csv") {
          downloadBlob(new Blob(["\ufeff", relCsv], { type: "text/csv;charset=utf-8;" }), `${relBaseName}.csv`);
          const headerBlock = [`EMPRESA;${empresa}`, `CNPJ;${cnpj}`, `ENDEREÇO;${endereco}`, `CONTATO;${contato}`, `RESPONSÁVEL;${responsavel}`, `PERÍODO;${periodo}`, ""].join("\n");
          const tableRows = [headers.join(";"), ...rowsFmt.map((row) => headers.map((h) => `"${String(row[h as keyof typeof row] ?? "").replace(/"/g, '""')}"`).join(";"))];
          const totalBlock = ["", `VALOR TOTAL: ${periodo};${formatCurrency(totalVal)}`].join("\n");
          downloadBlob(new Blob(["\ufeff", [headerBlock, ...tableRows, totalBlock].join("\n")], { type: "text/csv;charset=utf-8;" }), `${notesBaseName}.csv`);
        } else if (format === "xlsx") {
          const wbRel = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wbRel, XLSX.utils.aoa_to_sheet(relatorioRowsForXlsx(relatorio)), "Relatório");
          downloadBlob(new Blob([XLSX.write(wbRel, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${relBaseName}.xlsx`);
          const wbNotas = XLSX.utils.book_new();
          const headerData = [["EMPRESA", empresa], ["CNPJ", cnpj], ["ENDEREÇO", endereco], ["CONTATO", contato], ["RESPONSÁVEL", responsavel], ["PERÍODO", periodo], [], headers];
          const dataRows = rowsRaw.map((r) => headers.map((h) => r[h] ?? ""));
          const totalRow = [[`VALOR TOTAL: ${periodo}`, formatCurrency(totalVal), ...Array(Math.max(0, headers.length - 2)).fill("")] as (string | number)[]];
          XLSX.utils.book_append_sheet(wbNotas, XLSX.utils.aoa_to_sheet([...headerData, ...dataRows, ...totalRow]), "Auditoria");
          downloadBlob(new Blob([XLSX.write(wbNotas, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${notesBaseName}.xlsx`);
        } else {
          const relPdf = generateRelatorioPdf(relatorio);
          const notasPdf = generateNotasPdf(headers, rowsFmt, meta);
          downloadBlob(relPdf, `${relBaseName}.pdf`);
          downloadBlob(notasPdf, `${notesBaseName}.pdf`);
        }
      } else {
        const loadingId = sonnerToast.loading("A exportar: API de estatísticas, captura dos gráficos (demora) e ficheiros…");
        try {
          const { default: JSZip } = await import("jszip");
          const zip = new JSZip();

          zip.file("relatorio-auditoria-fiscal.pdf", generateRelatorioPdf(relatorio));

          // 1× toPng + recorte por cartão → PDF sem cortar blocos a meio na mudança de página.
          try {
            await fetchStats();
            await new Promise<void>((r) => {
              requestAnimationFrame(() => requestAnimationFrame(() => r()));
            });
            await new Promise((r) => setTimeout(r, 200));
            if (chartsContainerRef.current) {
              const cardPngs = await captureAuditoriaChartCardPngs(chartsContainerRef.current, { pixelRatio: 2.5 });
              const graficosPdf = await generateGraficosPdf(cardPngs);
              zip.file("graficos-e-indicadores.pdf", graficosPdf);
            } else {
              console.warn("Export: ref dos gráficos indisponível.");
            }
          } catch (err) {
            console.warn("Não foi possível capturar os gráficos:", err);
          }

          if (format === "csv") {
            const headerBlock = [`EMPRESA;${empresa}`, `CNPJ;${cnpj}`, `ENDEREÇO;${endereco}`, `CONTATO;${contato}`, `RESPONSÁVEL;${responsavel}`, `PERÍODO;${periodo}`, ""].join("\n");
            const tableRows = [headers.join(";"), ...rowsFmt.map((row) => headers.map((h) => `"${String(row[h as keyof typeof row] ?? "").replace(/"/g, '""')}"`).join(";"))];
            const totalBlock = ["", `VALOR TOTAL: ${periodo};${formatCurrency(totalVal)}`].join("\n");
            zip.file("notas-fiscais-auditoria.csv", new Blob(["\ufeff", [headerBlock, ...tableRows, totalBlock].join("\n")], { type: "text/csv;charset=utf-8;" }));
          } else if (format === "xlsx") {
            const wbNotas = XLSX.utils.book_new();
            const headerData = [["EMPRESA", empresa], ["CNPJ", cnpj], ["ENDEREÇO", endereco], ["CONTATO", contato], ["RESPONSÁVEL", responsavel], ["PERÍODO", periodo], [], headers];
            const dataRows = rowsRaw.map((r) => headers.map((h) => r[h] ?? ""));
            const totalRow = [[`VALOR TOTAL: ${periodo}`, formatCurrency(totalVal), ...Array(Math.max(0, headers.length - 2)).fill("")] as (string | number)[]];
            XLSX.utils.book_append_sheet(wbNotas, XLSX.utils.aoa_to_sheet([...headerData, ...dataRows, ...totalRow]), "Notas");
            zip.file("notas-fiscais-auditoria.xlsx", XLSX.write(wbNotas, { type: "base64", bookType: "xlsx" }), { base64: true });
          } else {
            zip.file("notas-fiscais-auditoria.pdf", generateNotasPdf(headers, rowsFmt, meta));
          }

          const zipBlob = await zip.generateAsync({ type: "blob" });
          downloadBlob(zipBlob, `${zipBaseName}.zip`);
        } finally {
          sonnerToast.dismiss(loadingId);
        }
      }

      const itemCount = rowsFmt.length;
      toast.success(
        filtered
          ? `Exportados: relatório e tabela — ${exportSource.length} nota(s), ${itemCount} item(ns).`
          : `Exportado: ${zipBaseName}.zip (Relatório, Gráficos, Notas) — ${exportSource.length} nota(s), ${itemCount} item(ns).`
      );
    },
    [client, exportFields, monthOptions, selectedMonth, selectedYear, fetchStats]
  );

  const openAuditoriaExport = useCallback((format: "csv" | "xlsx" | "pdf", records: NfeRecord[] | null) => {
    const src = records ?? displayNotes;
    if (src.length === 0) {
      toast.error(records ? "Nenhum item para exportar." : "Nenhuma nota no período para exportar.");
      return;
    }
    setPendingExport({ format, records });
    setRelatorioModalOpen(true);
  }, [displayNotes]);

  const handleTableExport = useCallback(
    async (format: "csv" | "xlsx" | "pdf") => {
      try {
        const all = await fetchAllNotesForTableQuery();
        if (all.length === 0) {
          toast.error("Nada para exportar com o filtro atual (o GET já aplica busca, período e venda/compra).");
          return;
        }
        openAuditoriaExport(format, all);
      } catch (e) {
        console.error(e);
        toast.error("Não foi possível carregar as notas para exportar.");
      }
    },
    [fetchAllNotesForTableQuery, openAuditoriaExport]
  );

  const handleRelatorioConfirm = useCallback(
    async (data: RelatorioAuditoriaFormData) => {
      if (!pendingExport) return;
      const source = pendingExport.records ?? displayNotes;
      try {
        await performAuditoriaExport(data, pendingExport.format, source, pendingExport.records !== null);
      } catch (e) {
        console.error(e);
        toast.error("Erro ao exportar. Tente novamente.");
      }
    },
    [pendingExport, displayNotes, performAuditoriaExport]
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
    setDeleteLoading("month");
    try {
      const count = await deleteByMonth(selectedMonth);
      await fetchNotes();
      await fetchTableNotes();
      await fetchAlerts();
      await fetchStats();
      toast.success(count > 0 ? `${count} nota(s) excluída(s). Faça o upload dos XMLs novamente.` : "Nenhuma nota encontrada para este mês.");
    } catch (e) {
      toast.error("Erro ao excluir notas.");
      console.error(e);
    } finally {
      setDeleteLoading(null);
    }
  }, [selectedMonth, monthOptions, confirm, deleteByMonth, fetchNotes, fetchTableNotes, fetchAlerts, fetchStats]);

  const handleDeleteYear = useCallback(async () => {
    if (!selectedYear) return;
    const confirmed = await confirm({
      title: "Excluir notas do ano",
      description: `Excluir todas as notas de ${selectedYear}? Você poderá fazer o upload dos XMLs novamente. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!confirmed) return;
    setDeleteLoading("year");
    try {
      const count = await deleteByYear(selectedYear);
      await fetchNotes();
      await fetchTableNotes();
      await fetchAlerts();
      await fetchStats();
      toast.success(
        count > 0 ? `${count} nota(s) do ano ${selectedYear} excluída(s).` : `Nenhuma nota encontrada para ${selectedYear}.`
      );
    } catch (e) {
      toast.error("Erro ao excluir notas do ano.");
      console.error(e);
    } finally {
      setDeleteLoading(null);
    }
  }, [selectedYear, confirm, deleteByYear, fetchNotes, fetchTableNotes, fetchAlerts, fetchStats]);

  const handleDeleteAll = useCallback(async () => {
    if (notes.length === 0) return;
    const confirmed = await confirm({
      title: "Excluir todas as notas",
      description: `Remover todas as ${notes.length} nota(s) deste cliente (alertas e prestação serão apagados). Você poderá importar os XMLs novamente. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir todas",
      variant: "destructive",
    });
    if (!confirmed) return;
    setDeleteLoading("all");
    try {
      const count = await deleteAllNotes();
      await fetchNotes();
      await fetchTableNotes();
      await fetchAlerts();
      await fetchStats();
      toast.success(count > 0 ? `${count} nota(s) excluída(s).` : "Nenhuma nota para excluir.");
    } catch (e) {
      toast.error("Erro ao excluir notas.");
      console.error(e);
    } finally {
      setDeleteLoading(null);
    }
  }, [notes.length, confirm, deleteAllNotes, fetchNotes, fetchTableNotes, fetchAlerts, fetchStats]);

  /**
   * Carga inicial por cliente:
   * - GET /fiscal-alerts → score, cards, `loading` (skeleton da página até terminar).
   * - GET /notes (sem page) em background → `notes` para filtros ano/mês; não bloqueia o layout.
   * - GET /notes?...&page=&perPage= → tabela (efeito abaixo); usa `tableLoading` só na tabela.
   */
  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    Promise.all([fetchAlerts()]).finally(() => setLoading(false));
    void fetchNotes();
  }, [clientId, fetchNotes, fetchAlerts]);

  useEffect(() => {
    if (!clientId) return;
    fetchTableNotes();
  }, [clientId, selectedYear, selectedMonth, tableSearchQuery, fetchTableNotes]);

  useEffect(() => {
    if (!clientId) {
      setConfazStRows([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/tax/confaz-st", {
          headers: getAuthHeaders(),
          credentials: "include",
        });
        if (!res.ok) {
          setConfazStRows([]);
          return;
        }
        const data = (await res.json()) as { items?: ConfazStApiItem[] };
        if (Array.isArray(data.items)) {
          setConfazStRows(confazRowsFromApi(data.items));
        } else {
          setConfazStRows([]);
        }
      } catch {
        setConfazStRows([]);
      }
    })();
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    // Painel "Gráficos" usa forceMount: precisa de stats no DOM mesmo fora da aba (export captura o ref).
    fetchStats();
  }, [clientId, selectedYear, selectedMonth, statsOperacao, fetchStats]);

  const alertsForTableDisplay = useMemo(() => {
    const chaves = new Set(tableDisplayNotes.map((r) => r.chave));
    return alerts.filter((a) => chaves.has(a.chave));
  }, [alerts, tableDisplayNotes]);

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
                <DropdownMenuItem onClick={() => openAuditoriaExport("xlsx", null)}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAuditoriaExport("csv", null)}>CSV (.csv)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAuditoriaExport("pdf", null)}>PDF</DropdownMenuItem>
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

          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            {yearOptions.length > 0 && (
              <>
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
              </>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Operação</Label>
              <Select
                value={statsOperacao}
                onValueChange={(v) => setStatsOperacao(v as "todos" | "venda" | "compra")}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="compra">Compra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="w-full text-[11px] text-slate-500 sm:w-auto sm:flex-1 sm:pl-2">
              Mesmo filtro para gráficos/resumo e tabela (abas separadas para desempenho).
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "tabela" | "graficos" | "inconsistencias")} className="mb-6">
            <TabsList className="mb-4">
              <TabsTrigger value="tabela">Tabela de notas</TabsTrigger>
              <TabsTrigger value="graficos">Gráficos e resumo</TabsTrigger>
              <TabsTrigger value="inconsistencias">Inconsistências</TabsTrigger>
            </TabsList>

            <TabsContent value="tabela" className="space-y-6">
              {activeTab === "tabela" ? (
                <AuditoriaItemsTable
                  records={tableDisplayNotes}
                  alerts={alertsForTableDisplay}
                  searchQuery={tableSearchQuery}
                  onSearchQueryChange={setTableSearchQuery}
                  loading={tableLoading}
                  onDeleteMonth={handleDeleteMonth}
                  onDeleteYear={handleDeleteYear}
                  onDeleteAll={handleDeleteAll}
                  deleteLoading={deleteLoading}
                  deleteMonthDisabled={!selectedMonth || monthFilteredNotes.length === 0}
                  deleteYearDisabled={!selectedYear || yearFilteredNotes.length === 0}
                  deleteAllDisabled={notes.length === 0}
                  itemCountForQuery={tableListMeta?.total ?? 0}
                  onExportFiltered={handleTableExport}
                  pagination={
                    tableListMeta
                      ? {
                          page: tableListMeta.page,
                          totalPages: tableListMeta.totalPages,
                          total: tableListMeta.total,
                          perPage: tableListMeta.perPage,
                          onPageChange: (p) => setTablePage(p),
                        }
                      : undefined
                  }
                  clientCnpj={client?.cnpj}
                  confazStRows={confazStRows}
                />
              ) : null}
            </TabsContent>

            <TabsContent
              value="graficos"
              forceMount
              className="data-[state=active]:relative data-[state=active]:z-auto data-[state=active]:w-full data-[state=inactive]:pointer-events-none data-[state=inactive]:fixed data-[state=inactive]:-left-[200vw] data-[state=inactive]:top-0 data-[state=inactive]:z-0 data-[state=inactive]:w-[min(100vw,80rem)] data-[state=inactive]:max-w-full space-y-6 outline-none"
            >
              {activeTab !== "graficos" ? null : statsLoading ? (
                <ResumoAnalysisSkeleton />
              ) : stats ? (
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="size-5" />
                      Resumo da análise
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      {stats.notesCount > 0
                        ? `Dados extraídos de ${stats.notesCount} nota(s) (${stats.vendaCount ?? 0} venda, ${stats.compraCount ?? 0} compra) e ${stats.itemsCount} item(ns)${
                            stats.operacao && stats.operacao !== "todos"
                              ? ` — filtro: ${stats.operacao === "venda" ? "apenas venda" : "apenas compra"}`
                              : ""
                          }`
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
              ) : null}
              <div ref={chartsContainerRef}>
                <AuditoriaCharts
                  loading={statsLoading}
                  operacaoFilter={statsOperacao}
                  stats={
                    stats
                      ? {
                          totalICMS: stats.totalICMS,
                          totalPIS: stats.totalPIS,
                          totalCOFINS: stats.totalCOFINS,
                          itemsCount: stats.itemsCount,
                          totalItemsValue: stats.totalItemsValue ?? 0,
                          topCfops: stats.topCfops ?? [],
                          topNcms: stats.topNcms ?? [],
                          icmsByMonth: stats.icmsByMonth ?? [],
                          itemsByMonth: stats.itemsByMonth ?? [],
                        }
                      : null
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="inconsistencias">
              {activeTab !== "inconsistencias" ? null : <Card className="border-slate-200 shadow-sm">
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
          </Card>}
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
          <RelatorioAuditoriaModal
            open={relatorioModalOpen}
            onOpenChange={(open) => {
              setRelatorioModalOpen(open);
              if (!open) setPendingExport(null);
            }}
            exportFormatLabel={
              pendingExport?.format === "csv"
                ? "CSV"
                : pendingExport?.format === "pdf"
                  ? "PDF"
                  : "Excel (.xlsx)"
            }
            summary={relatorioSummaryForRecords(
              pendingExport ? (pendingExport.records ?? displayNotes) : displayNotes,
              alerts
            )}
            alerts={alertsForRecords(
              pendingExport ? (pendingExport.records ?? displayNotes) : displayNotes,
              alerts
            )}
            defaultResponsavel={client?.responsavel ?? ""}
            onConfirm={handleRelatorioConfirm}
          />
        </>
      )}
    </div>
  );
}
