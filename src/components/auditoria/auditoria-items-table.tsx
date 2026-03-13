"use client";

import { useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { formatCurrency, formatCnpj } from "@/lib/nfe";
import type { NfeRecord, NfeItem } from "@/lib/nfe";

type FiscalAlertRow = {
  chave: string;
  itemIndex: number | null;
  productId: string | null;
  tipo: string;
  nivel: string;
  descricao?: string;
};

type Props = {
  records: NfeRecord[];
  alerts: FiscalAlertRow[];
  onDeleteMonth?: () => void;
  deleteMonthLoading?: boolean;
  deleteMonthDisabled?: boolean;
  /** CNPJ do cliente - usado como fallback do destinatário em compras quando cnpj está ausente */
  clientCnpj?: string | null;
};

export default function AuditoriaItemsTable({
  records,
  alerts,
  onDeleteMonth,
  deleteMonthLoading = false,
  deleteMonthDisabled = true,
  clientCnpj,
}: Props) {
  const [ncmSearch, setNcmSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<{ chave: string; itemIndex: number } | null>(null);

  const alertMap = useMemo(() => {
    const m = new Map<string, FiscalAlertRow>();
    for (const a of alerts) {
      const key = `${a.chave}:${a.itemIndex ?? -1}`;
      m.set(key, a);
    }
    return m;
  }, [alerts]);

  const flatItems = useMemo(() => {
    const items: Array<{
      chave: string;
      numero: string;
      dataEmissao: string;
      tipo: string;
      itemIndex: number;
      item: NfeItem;
      alert?: FiscalAlertRow;
      emitente?: { cnpj: string; razaoSocial: string };
      destinatario?: { cnpj: string; razaoSocial: string };
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

  const filteredItems = useMemo(() => {
    const search = ncmSearch.trim().replace(/\D/g, "");
    if (!search || search.length < 2) return flatItems;
    return flatItems.filter(({ item }) => {
      const itemNcm = (item.ncm ?? "").replace(/\D/g, "");
      return itemNcm.includes(search) || search.includes(itemNcm);
    });
  }, [flatItems, ncmSearch]);

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

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Análise por itens</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-500">Buscar NCM</label>
          <Input
            placeholder="Ex: 28043000"
            className="w-[180px] font-mono text-sm"
            value={ncmSearch}
            onChange={(e) => setNcmSearch(e.target.value)}
          />
          {onDeleteMonth && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              disabled={deleteMonthLoading || deleteMonthDisabled}
              onClick={onDeleteMonth}
            >
              {deleteMonthLoading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {deleteMonthLoading ? "Excluindo..." : "Excluir mês"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table className="table-fixed min-w-[1200px]">
            <colgroup>
              <col className="w-[90px]" />
              <col className="w-[200px]" />
              <col className="w-[200px]" />
              <col className="w-[220px]" />
              <col className="w-[100px]" />
              <col className="w-[90px]" />
              <col className="w-[70px]" />
              <col className="w-[50px]" />
              <col className="w-[95px]" />
              <col className="w-[95px]" />
              <col className="w-[85px]" />
              <col className="w-[95px]" />
              <col className="w-[70px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Nota</TableHead>
                <TableHead className="whitespace-nowrap">Emitente</TableHead>
                <TableHead className="whitespace-nowrap">Destinatário</TableHead>
                <TableHead className="whitespace-nowrap">Produto</TableHead>
                <TableHead className="font-mono">NCM</TableHead>
                <TableHead className="font-mono">CEST</TableHead>
                <TableHead className="font-mono">CFOP</TableHead>
                <TableHead className="whitespace-nowrap">CST</TableHead>
                <TableHead className="text-right whitespace-nowrap">BC ICMS</TableHead>
                <TableHead className="text-right whitespace-nowrap">ICMS</TableHead>
                <TableHead className="text-right whitespace-nowrap">PIS</TableHead>
                <TableHead className="text-right whitespace-nowrap">COFINS</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="py-8 text-center text-slate-500">
                    {flatItems.length === 0
                      ? "Nenhum item para exibir. Importe XMLs em Documentos fiscais."
                      : "Nenhum item encontrado para o NCM informado."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map(({ chave, numero, tipo, itemIndex, item, alert, emitente, destinatario }) => {
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
                  <TableRow
                    key={`${chave}-${itemIndex}`}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setSelectedItem({ chave, itemIndex })}
                  >
                    <TableCell className="font-medium">
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
                    <TableCell className="text-sm align-top whitespace-normal break-words overflow-hidden">
                      {renderNomeComCnpj(destinatario?.razaoSocial, destCnpj ?? undefined)}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words overflow-hidden" title={item.description}>
                      <span className="line-clamp-2" title={item.description}>{item.description}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{item.ncm ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{item.cest || "—"}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{item.cfop ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{item.cst ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.vBC ?? 0)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.vICMS ?? 0)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.vPIS ?? 0)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">{formatCurrency(item.vCOFINS ?? 0)}</TableCell>
                    <TableCell className="whitespace-nowrap">{getStatusBadge(alert)}</TableCell>
                  </TableRow>
                );})
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <AuditoriaItemDetailsDialog
        record={selectedRecord}
        item={selectedItemData}
        itemIndex={selectedItem?.itemIndex ?? 0}
        alert={selectedItem ? alertMap.get(`${selectedItem.chave}:${selectedItem.itemIndex}`) : undefined}
        open={!!selectedItem && !!selectedRecord && !!selectedItemData}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        clientCnpj={clientCnpj}
      />
    </Card>
  );
}
