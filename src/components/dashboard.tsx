'use client';

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, parseNfeXml, summarizeItems, type NfeRecord } from "@/lib/nfe";
import AlertsPanel from "./dashboard/alerts-panel";
import NoteDetailsDialog from "@/components/dashboard/note-details-dialog";
import NotesTable, {
  type NotesTableFilters,
  type NotesTableFilterHandlers,
} from "@/components/dashboard/notes-table";
import PrestacaoPanel from "./dashboard/prestacao-panel";
import StatsCards from "./dashboard/stats-cards";
import Topbar, { TopbarSearch } from "./dashboard/topbar";

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

export default function Dashboard() {
  const [records, setRecords] = useState<NfeRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Autorizada" | "Cancelada">("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [productIdsFilter, setProductIdsFilter] = useState<string[]>([]);
  const [descriptionsFilter, setDescriptionsFilter] = useState<string[]>([]);
  const [cestsFilter, setCestsFilter] = useState<string[]>([]);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [includedMap, setIncludedMap] = useState<Record<string, boolean>>({});
  const [selectedRecord, setSelectedRecord] = useState<NfeRecord | null>(null);

  const monthOptions = useMemo(() => getMonthsFromRecords(records), [records]);

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
    return records.filter((r) => {
      const d = r.dataEmissao?.trim() ?? "";
      return d.length >= 7 && (d.slice(0, 7) === selectedMonth || d.startsWith(prefix));
    });
  }, [records, selectedMonth]);

  const productIds = useMemo(() => {
    const set = new Set<string>();
    monthFilteredRecords.forEach((record) => {
      record.itens.forEach((item) => {
        if (item.productId) set.add(item.productId);
      });
    });
    return Array.from(set.values());
  }, [monthFilteredRecords]);

  const descriptions = useMemo(() => {
    const set = new Set<string>();
    monthFilteredRecords.forEach((record) => {
      record.itens.forEach((item) => {
        if (item.description) set.add(item.description);
      });
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [monthFilteredRecords]);

  const cests = useMemo(() => {
    const set = new Set<string>();
    monthFilteredRecords.forEach((record) => {
      record.itens.forEach((item) => {
        if (item.cest) set.add(item.cest);
      });
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [monthFilteredRecords]);

  const filteredRecords = useMemo(() => {
    const q = query.toLowerCase();
    const productIdsToFilter = productIdsFilter.map((id) => id.trim().toLowerCase()).filter(Boolean);
    const descriptionsToFilter = descriptionsFilter
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const cestsToFilter = cestsFilter.map((c) => c.trim().toLowerCase()).filter(Boolean);
    const min = Number.parseFloat(minValue.replace(",", ".")) || 0;
    const max = Number.parseFloat(maxValue.replace(",", ".")) || Number.POSITIVE_INFINITY;

    return monthFilteredRecords.filter((record) => {
      const matchesQuery =
        !q ||
        [record.chave, record.numero].some((value) => value.toLowerCase().includes(q)) ||
        record.itens.some(
          (item) =>
            item.productId.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            (item.cest && item.cest.toLowerCase().includes(q))
        );
      const matchesProduct =
        productIdsToFilter.length === 0 ||
        record.itens.some((item) =>
          productIdsToFilter.some((pid) => item.productId.toLowerCase() === pid)
        );
      const matchesDescription =
        descriptionsToFilter.length === 0 ||
        record.itens.some((item) =>
          descriptionsToFilter.some((d) => item.description.toLowerCase() === d)
        );
      const matchesCest =
        cestsToFilter.length === 0 ||
        record.itens.some((item) =>
          cestsToFilter.some((c) => item.cest?.toLowerCase() === c)
        );
      const matchesStatus = statusFilter === "all" || record.status === statusFilter;
      const matchesCompany =
        companyFilter === "all" || record.emitente.cnpj === companyFilter;
      const matchesValue = record.valorTotal >= min && record.valorTotal <= max;

      return (
        matchesQuery &&
        matchesProduct &&
        matchesDescription &&
        matchesCest &&
        matchesStatus &&
        matchesCompany &&
        matchesValue
      );
    });
  }, [
    monthFilteredRecords,
    query,
    productIds,
    descriptions,
    cests,
    productIdsFilter,
    descriptionsFilter,
    cestsFilter,
    statusFilter,
    companyFilter,
    minValue,
    maxValue,
  ]);

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    monthFilteredRecords.forEach((record) => {
      if (record.emitente.cnpj) {
        map.set(record.emitente.cnpj, record.emitente.razaoSocial || record.emitente.cnpj);
      }
    });
    return Array.from(map.entries()).map(([cnpj, razaoSocial]) => ({ cnpj, razaoSocial }));
  }, [monthFilteredRecords]);

  const metrics = useMemo(() => {
    const totalValue = monthFilteredRecords.reduce((acc, record) => acc + record.valorTotal, 0);
    const authorized = monthFilteredRecords.filter((record) => record.status === "Autorizada");
    const canceled = monthFilteredRecords.filter((record) => record.status === "Cancelada");
    const included = authorized.filter((record) => includedMap[record.chave]);
    const pending = authorized.filter((record) => !includedMap[record.chave]);
    return {
      totalValue,
      count: monthFilteredRecords.length,
      authorizedCount: authorized.length,
      canceledCount: canceled.length,
      pendingValue: pending.reduce((acc, record) => acc + record.valorTotal, 0),
      pendingCount: pending.length,
      includedCount: included.length,
    };
  }, [monthFilteredRecords, includedMap]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const parsed: { name: string; record: NfeRecord | null }[] = [];

    for (const file of Array.from(files)) {
      if (file.name.toLowerCase().endsWith(".zip")) {
        try {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.values(zip.files).filter((entry) => !entry.dir);
          for (const entry of entries) {
            if (!entry.name.toLowerCase().endsWith(".xml")) continue;
            const text = await entry.async("text");
            parsed.push({ name: `${file.name}:${entry.name}`, record: parseNfeXml(text) });
          }
        } catch (error) {
          parsed.push({ name: file.name, record: null });
        }
      } else {
        try {
          const text = await file.text();
          parsed.push({ name: file.name, record: parseNfeXml(text) });
        } catch (error) {
          parsed.push({ name: file.name, record: null });
        }
      }
    }

    setRecords((prev) => {
      const map = new Map(prev.map((item) => [item.chave, item]));
      parsed.forEach((item) => {
        if (item.record?.chave) {
          map.set(item.record.chave, item.record);
        }
      });
      return Array.from(map.values());
    });

  };

  const exportSource = useMemo(() => {
    const included = monthFilteredRecords.filter((record) => includedMap[record.chave]);
    if (included.length > 0) return included;
    return filteredRecords;
  }, [monthFilteredRecords, filteredRecords, includedMap]);

  const allSelected = useMemo(() => {
    if (filteredRecords.length === 0) return false;
    return filteredRecords.every((record) => includedMap[record.chave]);
  }, [filteredRecords, includedMap]);

  const exportCsv = () => {
    const rows = exportSource.map((record) => ({
      Data: formatDate(record.dataEmissao),
      "Chave de acesso": record.chave,
      "NF-e/NFC-e": record.numero,
      Valor: formatCurrency(record.valorTotal),
      "Discriminação dos itens": summarizeItems(record.itens),
      Status: record.status,
    }));
    const headers = Object.keys(rows[0] ?? {
      Data: "",
      "Chave de acesso": "",
      "NF-e/NFC-e": "",
      Valor: "",
      "Discriminação dos itens": "",
      Status: "",
    });
    const csv = [
      headers.join(";"),
      ...rows.map((row) => headers.map((header) => `"${row[header as keyof typeof row]}"`).join(";")),
    ].join("\n");
    downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" }), "prestacao-contas.csv");
  };

  const exportXlsx = () => {
    const rows = exportSource.map((record) => ({
      Data: formatDate(record.dataEmissao),
      "Chave de acesso": record.chave,
      "NF-e/NFC-e": record.numero,
      Valor: record.valorTotal,
      "Discriminação dos itens": summarizeItems(record.itens),
      Status: record.status,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Prestacao");
    const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    downloadBlob(
      new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      "prestacao-contas.xlsx"
    );
  };

  const exportPdf = () => {
    const rows = exportSource.map((record) => ({
      data: formatDate(record.dataEmissao),
      chave: record.chave,
      numero: record.numero,
      valor: formatCurrency(record.valorTotal),
      itens: summarizeItems(record.itens),
    }));

    const html = `
      <html>
        <head>
          <title>Prestação de contas</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { font-size: 18px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Prestação de contas - notas fiscais</h1>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Chave de acesso</th>
                <th>NF-e/NFC-e</th>
                <th>Valor</th>
                <th>Discriminação dos itens</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                <tr>
                  <td>${row.data}</td>
                  <td>${row.chave}</td>
                  <td>${row.numero}</td>
                  <td>${row.valor}</td>
                  <td>${row.itens}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <Topbar
        onFilesSelected={handleFiles}
        exportDisabled={filteredRecords.length === 0}
        onExportCsv={exportCsv}
        onExportPdf={exportPdf}
        onExportXlsx={exportXlsx}
      />

      <section className="px-6 py-6">
        <StatsCards metrics={metrics} />

        <Tabs defaultValue="notas" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="notas">Notas</TabsTrigger>
              <TabsTrigger value="prestacao">Prestação de contas</TabsTrigger>
              <TabsTrigger value="alertas">Alertas fiscais</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap items-center gap-3">
              <TopbarSearch value={query} onChange={(value: string) => setQuery(value)} />
            </div>
          </div>

          <TabsContent value="notas" className="mt-6">
            <NotesTable
              records={filteredRecords}
              includedMap={includedMap}
              onToggleIncluded={(chave, value) =>
                setIncludedMap((prev) => ({ ...prev, [chave]: value }))
              }
              onSelectRecord={(record) => setSelectedRecord(record)}
              companies={companies}
              productIds={productIds}
              descriptions={descriptions}
              cests={cests}
              allSelected={allSelected}
              onToggleAll={(value) => {
                setIncludedMap((prev) => {
                  const next = { ...prev };
                  filteredRecords.forEach((record) => {
                    next[record.chave] = value;
                  });
                  return next;
                });
              }}
              filters={
                {
                  status: statusFilter,
                  company: companyFilter,
                  productIds: productIdsFilter,
                  descriptions: descriptionsFilter,
                  cests: cestsFilter,
                  minValue,
                  maxValue,
                  month: selectedMonth,
                } as NotesTableFilters
              }
              onFiltersChange={
                {
                  setStatus: setStatusFilter,
                  setCompany: setCompanyFilter,
                  setProductIds: setProductIdsFilter,
                  setDescriptions: setDescriptionsFilter,
                  setCests: setCestsFilter,
                  setMinValue,
                  setMaxValue,
                  setMonth: setSelectedMonth,
                } as NotesTableFilterHandlers
              }
              monthOptions={monthOptions}
            />
          </TabsContent>

          <TabsContent value="prestacao" className="mt-6">
            <PrestacaoPanel
              records={monthFilteredRecords}
              metrics={metrics}
              onExportCsv={exportCsv}
              onExportPdf={exportPdf}
              onExportXlsx={exportXlsx}
            />
          </TabsContent>

          <TabsContent value="alertas" className="mt-6">
            <AlertsPanel records={monthFilteredRecords} metrics={metrics} />
          </TabsContent>
        </Tabs>
      </section>

      <NoteDetailsDialog
        record={selectedRecord}
        open={Boolean(selectedRecord)}
        onOpenChange={(open) => {
          if (!open) setSelectedRecord(null);
        }}
      />
    </div>
  );
}
