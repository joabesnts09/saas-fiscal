"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Library, Loader2, Trash2 } from "lucide-react";
import AuditoriaItemDetailsDialog from "./auditoria-item-details-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatCnpj, formatLocalidadeParticipante } from "@/lib/nfe";
import type { NfeRecord, NfeItem } from "@/lib/nfe";
import type { ConfazStRow } from "@/lib/confaz-st-core";
import { enrichProductFromConfaz, type ConfazProductEnrichment } from "@/lib/confaz-enrichment";
import { AuditoriaItensTableBodySkeletonRows } from "@/components/auditoria/auditoria-skeletons";

type FiscalAlertRow = {
  chave: string;
  itemIndex: number | null;
  productId: string | null;
  tipo: string;
  nivel: string;
  descricao?: string;
};

function buildPageListWithGaps(current: number, total: number): (number | "gap")[] {
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, total, current]);
  if (current > 1) {
    set.add(current - 1);
  }
  if (current < total) {
    set.add(current + 1);
  }
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= total) {
      set.add(p);
    }
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev > 0 && n - prev > 1) {
      out.push("gap");
    }
    out.push(n);
    prev = n;
  }
  return out;
}

function PaginationBar({
  page,
  totalPages,
  disabled,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  disabled: boolean;
  onPageChange: (p: number) => void;
}) {
  const entries = useMemo(() => buildPageListWithGaps(page, totalPages), [page, totalPages]);
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft className="size-4" />
      </Button>
      {entries.map((entry, i) =>
        entry === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-xs text-slate-400">
            …
          </span>
        ) : (
          <Button
            key={entry}
            type="button"
            variant={entry === page ? "default" : "outline"}
            size="sm"
            className="min-w-8 px-2 tabular-nums"
            disabled={disabled}
            onClick={() => onPageChange(entry)}
          >
            {entry}
          </Button>
        )
      )}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Próxima página"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

type Props = {
  records: NfeRecord[];
  alerts: FiscalAlertRow[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  loading?: boolean;
  onDeleteMonth?: () => void;
  onDeleteYear?: () => void;
  onDeleteAll?: () => void;
  /** Qual exclusão está em andamento (botão único "Excluir") */
  deleteLoading?: "month" | "year" | "all" | null;
  deleteMonthDisabled?: boolean;
  deleteYearDisabled?: boolean;
  deleteAllDisabled?: boolean;
  /** Total de linhas (itens) do filtro na API (todas as páginas) — export e rótulo */
  itemCountForQuery?: number;
  /** Busca o conjunto completo no pai e exporta (CSV, XLSX, PDF) */
  onExportFiltered?: (format: "csv" | "xlsx" | "pdf") => void;
  /** Paginação (notas por página no back-end) */
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    perPage: number;
    onPageChange: (page: number) => void;
  };
  /** CNPJ do cliente - usado como fallback do destinatário em compras quando cnpj está ausente */
  clientCnpj?: string | null;
  /** Tabela CONFAZ (ST/CEST) para segmento e fundamento legal por NCM */
  confazStRows?: ConfazStRow[];
};

export default function AuditoriaItemsTable({
  records,
  alerts,
  searchQuery,
  onSearchQueryChange,
  loading = false,
  onDeleteMonth,
  onDeleteYear,
  onDeleteAll,
  deleteLoading = null,
  deleteMonthDisabled = true,
  deleteYearDisabled = true,
  deleteAllDisabled = true,
  itemCountForQuery = 0,
  onExportFiltered,
  pagination,
  clientCnpj,
  confazStRows = [],
}: Props) {
  const busy = deleteLoading !== null;
  const [selectedItem, setSelectedItem] = useState<{ chave: string; itemIndex: number } | null>(null);
  const [searchInput, setSearchInput] = useState(searchQuery);

  useEffect(() => {
    const id = window.setTimeout(() => {
      startTransition(() => {
        onSearchQueryChange(searchInput);
      });
    /* debounce ~ throttle de busca: evita 1 GET por tecla (back-end ainda agrega tudo p/ filtrar NCM) */
    }, 500);
    return () => window.clearTimeout(id);
  }, [searchInput, onSearchQueryChange]);

  const alertMap = useMemo(() => {
    const m = new Map<string, FiscalAlertRow>();
    for (const a of alerts) {
      const key = `${a.chave}:${a.itemIndex ?? -1}`;
      m.set(key, a);
    }
    return m;
  }, [alerts]);

  /** Linhas já filtradas no GET (NCM, período, venda/compra). 1 nota pode ter N linhas. */
  const displayRows = useMemo(() => {
    const items: Array<{
      chave: string;
      numero: string;
      dataEmissao: string;
      tipo: string;
      itemIndex: number;
      item: NfeItem;
      alert?: FiscalAlertRow;
      emitente?: NfeRecord["emitente"];
      destinatario?: NfeRecord["destinatario"];
    }> = [];
    for (const r of records) {
      r.itens.forEach((item, idx) => {
        const key = `${r.chave}:${idx}`;
        const alert = alertMap.get(key);
        items.push({
          chave: r.chave,
          numero: r.numero,
          dataEmissao: r.dataEmissao,
          tipo: r.tipo ?? "outro",
          itemIndex: idx,
          item,
          alert,
          emitente: r.emitente,
          destinatario: r.destinatario,
        });
      });
    }
    return items;
  }, [records, alertMap]);

  const confazByRowKey = useMemo(() => {
    const m = new Map<string, ConfazProductEnrichment>();
    for (const row of displayRows) {
      const key = `${row.chave}-${row.itemIndex}`;
      m.set(key, enrichProductFromConfaz(row.item, row.dataEmissao, confazStRows));
    }
    return m;
  }, [displayRows, confazStRows]);

  const canExportFiltered = !loading && (itemCountForQuery > 0) && !!onExportFiltered;

  const renderNomeComCnpj = (razaoSocial?: string, cnpj?: string) => {
    const nome = razaoSocial?.trim() || "—";
    const doc = cnpj?.trim();
    if (!doc || doc === "—") return <span className="break-words">{nome}</span>;
    const formatted = formatCnpj(doc);
    const label = doc.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ";
    return (
      <div className="space-y-0.5 break-words overflow-hidden min-w-0">
        <div className="text-slate-700 break-words">{nome}</div>
        <div className="text-xs text-slate-500 font-mono shrink-0">{label}: {formatted}</div>
      </div>
    );
  };

  const selectedRecord = useMemo(() => {
    if (!selectedItem) return null;
    return records.find((r) => r.chave === selectedItem.chave) ?? null;
  }, [records, selectedItem]);

  const selectedItemData = useMemo(() => {
    if (!selectedRecord || !selectedItem) return null;
    return selectedRecord.itens[selectedItem.itemIndex] ?? null;
  }, [selectedRecord, selectedItem]);

  const getStatusBadge = (alert?: FiscalAlertRow) => {
    if (!alert) {
      return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">OK</Badge>;
    }
    const isError = alert.nivel === "error";
    return (
      <Badge
        variant="outline"
        className={isError ? "border-rose-300 bg-rose-50 text-rose-700 text-xs" : "border-amber-300 bg-amber-50 text-amber-700 text-xs"}
      >
        {isError ? "Erro" : "Aviso"}
      </Badge>
    );
  };

  const tableBodyContent = useMemo(() => {
    if (loading) {
      return <AuditoriaItensTableBodySkeletonRows />;
    }

    if (displayRows.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={19} className="py-8 text-center text-slate-500">
            {records.length === 0
              ? "Nenhum item para exibir. Importe XMLs em Documentos fiscais."
              : "Nenhum item para o filtro (busca NCM/CEST/CFOP, período ou operação venda/compra)."}
          </TableCell>
        </TableRow>
      );
    }

    return displayRows.map(({ chave, numero, tipo, itemIndex, item, alert, emitente, destinatario }) => {
      const enc = confazByRowKey.get(`${chave}-${itemIndex}`);
      const destCnpjRaw = destinatario?.cnpj?.trim() && destinatario.cnpj !== "—" ? destinatario.cnpj : null;
      const destCnpj = destCnpjRaw ?? (
        (tipo === "compra" || tipo === "outro") &&
        clientCnpj &&
        (clientCnpj.replace(/\D/g, "") ?? "").length === 14
          ? clientCnpj
          : null
      );
      const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
      const cc = onlyDigits(clientCnpj);
      const ec = onlyDigits(emitente?.cnpj);
      const dc = onlyDigits(destCnpj ?? destinatario?.cnpj);
      const displayTipo: "compra" | "venda" | "outro" =
        tipo === "compra" || tipo === "venda"
          ? tipo
          : cc && (ec === cc || dc === cc)
            ? ec === cc ? "venda" : "compra"
            : "outro";
      return (
      <TableRow key={`${chave}-${itemIndex}`}>
        <TableCell
          className="font-medium cursor-pointer hover:bg-slate-100 transition-colors"
          onClick={() => setSelectedItem({ chave, itemIndex })}
          title="Clique para ver detalhes do item"
        >
          <Badge
            variant="outline"
            title={displayTipo === "compra" ? "Compra" : displayTipo === "venda" ? "Venda" : "Outro"}
            className={`mr-1.5 shrink-0 text-xs ${displayTipo === "compra" ? "border-blue-200 bg-blue-50 text-blue-700" : displayTipo === "venda" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}
          >
            {displayTipo === "compra" ? "C" : displayTipo === "venda" ? "V" : "—"}
          </Badge>
          <span className="font-mono text-xs">{numero}</span>
        </TableCell>
        <TableCell className="text-sm align-top whitespace-normal break-words overflow-hidden">
          {renderNomeComCnpj(emitente?.razaoSocial, emitente?.cnpj)}
        </TableCell>
        <TableCell className="text-xs align-top whitespace-normal text-slate-600" title={formatLocalidadeParticipante(emitente)}>
          {formatLocalidadeParticipante(emitente)}
        </TableCell>
        <TableCell className="text-sm align-top whitespace-normal break-words overflow-hidden">
          {renderNomeComCnpj(destinatario?.razaoSocial, destCnpj ?? undefined)}
        </TableCell>
        <TableCell className="text-xs align-top whitespace-normal text-slate-600" title={formatLocalidadeParticipante(destinatario)}>
          {formatLocalidadeParticipante(destinatario)}
        </TableCell>
        <TableCell className="whitespace-normal break-words overflow-hidden" title={item.description}>
          <span className="line-clamp-2" title={item.description}>{item.description}</span>
        </TableCell>
        <TableCell className="font-mono text-xs whitespace-nowrap">{item.ncm ?? "—"}</TableCell>
        <TableCell className="font-mono text-xs whitespace-nowrap">{item.cest || "—"}</TableCell>
        <TableCell className="align-top text-xs">
          {enc?.sujeitoSt ? (
            <div className="max-w-[200px] space-y-1.5 py-0.5">
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant="outline"
                  className="border-teal-300 bg-teal-50 text-[10px] text-teal-800"
                  title="Sujeito a ST segundo tabela CONFAZ na data da nota"
                >
                  ST
                </Badge>
                {enc.cestXmlCompativel === false ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-[10px] text-amber-800"
                    title="CEST do XML diferente do esperado na tabela"
                  >
                    CEST?
                  </Badge>
                ) : null}
              </div>
              <p className="line-clamp-2 leading-snug text-slate-700" title={enc.segmento ?? ""}>
                {enc.segmento ?? "—"}
              </p>
              <p
                className="line-clamp-2 text-[10px] leading-snug text-slate-500"
                title={enc.fundamentoLegal ?? ""}
              >
                {enc.fundamentoLegal}
              </p>
            </div>
          ) : (
            <div
              className="max-w-[200px] py-0.5 text-[11px] leading-snug text-slate-500"
              title={enc?.notaSobreIcms ?? ""}
            >
              <span className="font-medium text-slate-600">Sem linha na base</span>
              <p className="mt-0.5 line-clamp-2 text-slate-500">
                NCM não encontrado na tabela CONFAZ carregada. Rode o seed ou importe o anexo oficial.
              </p>
            </div>
          )}
        </TableCell>
        <TableCell className="font-mono text-xs whitespace-nowrap">{item.cfop ?? "—"}</TableCell>
        <TableCell className="font-mono text-xs whitespace-nowrap">{item.cst ?? "—"}</TableCell>
        <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.vBC ?? 0)}</TableCell>
        <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.vICMS ?? 0)}</TableCell>
        <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.vPIS ?? 0)}</TableCell>
        <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.vCOFINS ?? 0)}</TableCell>
        <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.vIBS ?? 0)}</TableCell>
        <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.vCBS ?? 0)}</TableCell>
        <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
          {formatCurrency(item.vProd ?? 0)}
        </TableCell>
        <TableCell className="whitespace-nowrap">{getStatusBadge(alert)}</TableCell>
      </TableRow>
    );});
  }, [loading, displayRows, records.length, confazByRowKey, clientCnpj]);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-4 w-full min-w-0">
          <CardTitle className="shrink-0">Análise por itens</CardTitle>
          <Input
            placeholder="Buscar NCM, CEST ou CFOP (GET query no back-end)"
            className="flex-1 min-w-0 font-mono text-sm"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {canExportFiltered && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  <Download className="size-4" />
                  Exportar busca ({itemCountForQuery} item(ns) no filtro)
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onExportFiltered?.("csv")}>CSV (.csv)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExportFiltered?.("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExportFiltered?.("pdf")}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {(onDeleteMonth || onDeleteYear || onDeleteAll) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      <ChevronDown className="size-4 opacity-70" />
                    </>
                  )}
                  {busy ? "Excluindo..." : "Excluir"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuItem
                  disabled={busy || deleteMonthDisabled}
                  className="cursor-pointer"
                  onSelect={() => onDeleteMonth?.()}
                >
                  Excluir mês
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={busy || deleteYearDisabled}
                  className="cursor-pointer"
                  onSelect={() => onDeleteYear?.()}
                >
                  Excluir ano
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={busy || deleteAllDisabled}
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                  onSelect={() => onDeleteAll?.()}
                >
                  Todas as notas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table className="table-fixed min-w-[1640px]">
            <colgroup>
              <col className="w-[90px]" />
              <col className="w-[170px]" />
              <col className="w-[110px]" />
              <col className="w-[170px]" />
              <col className="w-[110px]" />
              <col className="w-[200px]" />
              <col className="w-[100px]" />
              <col className="w-[90px]" />
              <col className="w-[200px]" />
              <col className="w-[70px]" />
              <col className="w-[50px]" />
              <col className="w-[95px]" />
              <col className="w-[95px]" />
              <col className="w-[85px]" />
              <col className="w-[95px]" />
              <col className="w-[95px]" />
              <col className="w-[72px]" />
              <col className="w-[72px]" />
              <col className="w-[76px]" />
              <col className="w-[70px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Nota</TableHead>
                <TableHead className="whitespace-nowrap">Emitente</TableHead>
                <TableHead className="whitespace-nowrap" title="UF e município do emitente">
                  Origem
                </TableHead>
                <TableHead className="whitespace-nowrap">Destinatário</TableHead>
                <TableHead className="whitespace-nowrap" title="UF e município do destinatário">
                  Destino
                </TableHead>
                <TableHead className="whitespace-nowrap">Produto</TableHead>
                <TableHead className="font-mono">NCM</TableHead>
                <TableHead className="font-mono">CEST</TableHead>
                <TableHead className="min-w-[180px]">
                  <span className="inline-flex items-center gap-1 text-slate-700">
                    <Library className="size-3.5 shrink-0 opacity-70" aria-hidden />
                    CONFAZ (NCM)
                  </span>
                </TableHead>
                <TableHead className="font-mono">CFOP</TableHead>
                <TableHead className="whitespace-nowrap">CST</TableHead>
                <TableHead className="text-right whitespace-nowrap">BC ICMS</TableHead>
                <TableHead className="text-right whitespace-nowrap">ICMS</TableHead>
                <TableHead className="text-right whitespace-nowrap">PIS</TableHead>
                <TableHead className="text-right whitespace-nowrap">COFINS</TableHead>
                <TableHead className="text-right whitespace-nowrap" title="Imposto sobre bens e serviços (reforma — XML)">
                  IBS
                </TableHead>
                <TableHead className="text-right whitespace-nowrap" title="Contribuição sobre bens e serviços (reforma — XML)">
                  CBS
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">Valor item</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{tableBodyContent}</TableBody>
          </Table>
        </div>
        {pagination && pagination.total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3">
            <p className="text-xs text-slate-600">
              <span className="font-medium tabular-nums">{pagination.total}</span> item(ns) de produto no filtro ·
              Página <span className="tabular-nums font-medium text-slate-800">{pagination.page}</span> de{" "}
              <span className="tabular-nums font-medium text-slate-800">{pagination.totalPages}</span> · até{" "}
              <span className="tabular-nums">{pagination.perPage}</span> itens por requisição
            </p>
            <PaginationBar
              page={pagination.page}
              totalPages={pagination.totalPages}
              disabled={loading}
              onPageChange={pagination.onPageChange}
            />
          </div>
        ) : null}
      </CardContent>
      <AuditoriaItemDetailsDialog
        record={selectedRecord}
        item={selectedItemData}
        itemIndex={selectedItem?.itemIndex ?? 0}
        alert={selectedItem ? alertMap.get(`${selectedItem.chave}:${selectedItem.itemIndex}`) : undefined}
        open={!!selectedItem && !!selectedRecord && !!selectedItemData}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        clientCnpj={clientCnpj}
        confazStRows={confazStRows}
      />
    </Card>
  );
}
