"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatCnpj, formatDate } from "@/lib/nfe";
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
  record: NfeRecord | null;
  item: NfeItem | null;
  itemIndex: number;
  alert?: FiscalAlertRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientCnpj?: string | null;
};

export default function AuditoriaItemDetailsDialog({
  record,
  item,
  itemIndex,
  alert,
  open,
  onOpenChange,
  clientCnpj,
}: Props) {
  if (!record || !item) return null;

  const tipoLabel = record.tipo === "compra" ? "Compra" : record.tipo === "venda" ? "Venda" : "Outro";
  const destCnpjRaw = record.destinatario?.cnpj?.trim() && record.destinatario.cnpj !== "—"
    ? record.destinatario.cnpj
    : null;
  const destCnpj = destCnpjRaw ?? (
    (record.tipo === "compra" || record.tipo === "outro") &&
    clientCnpj &&
    (clientCnpj.replace(/\D/g, "") ?? "").length === 14
      ? clientCnpj
      : null
  );

  const docLabel = (doc: string) =>
    doc.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ";

  const Field = ({ label, value, mono, highlight }: { label: string; value: ReactNode; mono?: boolean; highlight?: boolean }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className={`text-slate-900 ${mono ? "font-mono text-sm" : ""} ${highlight ? "font-semibold" : ""}`}>
        {value}
      </span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header com fundo diferenciado */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
              <span>Item #{itemIndex + 1} — Nota {record.numero}</span>
              <Badge
                variant="outline"
                className={`text-xs ${record.tipo === "compra" ? "border-blue-200 bg-blue-100/80 text-blue-700" : record.tipo === "venda" ? "border-emerald-200 bg-emerald-100/80 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}
              >
                {tipoLabel}
              </Badge>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="space-y-0 overflow-y-auto">
          {/* Dados da nota */}
          <section className="border-b border-slate-100 bg-white px-6 py-5">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="h-1 w-1 rounded-full bg-slate-400" />
              Dados da nota
            </h4>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-500">Chave de acesso</span>
                <div className="select-text rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-700 break-all">
                  {record.chave}
                </div>
              </div>
              <Field label="Data de emissão" value={formatDate(record.dataEmissao)} />
              <Field label="Série" value={record.serie} />
              <Field label="Status" value={record.status} />
              <Field label="Valor total" value={formatCurrency(record.valorTotal)} highlight />
              <div className="sm:col-span-2 space-y-1">
                <span className="text-xs font-medium text-slate-500">Emitente</span>
                <div className="rounded-md border border-slate-100 bg-slate-50/30 px-3 py-2">
                  <p className="text-slate-900">{record.emitente.razaoSocial}</p>
                  {record.emitente.cnpj && (
                    <p className="mt-0.5 font-mono text-xs text-slate-600">
                      {docLabel(record.emitente.cnpj)}: {formatCnpj(record.emitente.cnpj)}
                    </p>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <span className="text-xs font-medium text-slate-500">Destinatário</span>
                <div className="rounded-md border border-slate-100 bg-slate-50/30 px-3 py-2">
                  <p className="text-slate-900">{record.destinatario?.razaoSocial ?? "—"}</p>
                  {(destCnpj ?? record.destinatario?.cnpj) && (
                    <p className="mt-0.5 font-mono text-xs text-slate-600">
                      {docLabel((destCnpj ?? record.destinatario?.cnpj) ?? "")}:{" "}
                      {formatCnpj((destCnpj ?? record.destinatario?.cnpj) ?? "")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Dados do produto */}
          <section className="border-b border-slate-100 bg-slate-50/30 px-6 py-5">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="h-1 w-1 rounded-full bg-slate-400" />
              Dados do produto
            </h4>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="mb-1 block text-xs font-medium text-slate-500">Descrição</span>
                <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900">
                  {item.description || "—"}
                </p>
              </div>
              {item.productId && (
                <Field label="ID produto" value={item.productId} mono />
              )}
              <Field label="NCM" value={item.ncm ?? "—"} mono />
              <Field label="CEST" value={item.cest || "—"} mono />
              <Field label="CFOP" value={item.cfop ?? "—"} mono />
              <Field label="CST" value={item.cst ?? "—"} mono />
              <Field label="Quantidade" value={item.quantity ?? "—"} />
              <Field label="Valor unitário" value={item.vUnCom != null ? formatCurrency(item.vUnCom) : "—"} />
              <Field label="Valor do item" value={item.vProd != null ? formatCurrency(item.vProd) : "—"} highlight />
            </div>
            {/* Tributos em destaque */}
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <span className="mb-3 block text-xs font-medium text-slate-500">Impostos e contribuições</span>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <span className="text-xs text-slate-500">Base ICMS</span>
                  <p className="font-mono text-sm font-medium text-slate-900">{formatCurrency(item.vBC ?? 0)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">ICMS</span>
                  <p className="font-mono text-sm font-medium text-slate-900">{formatCurrency(item.vICMS ?? 0)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">PIS</span>
                  <p className="font-mono text-sm font-medium text-slate-900">{formatCurrency(item.vPIS ?? 0)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">COFINS</span>
                  <p className="font-mono text-sm font-medium text-slate-900">{formatCurrency(item.vCOFINS ?? 0)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Alerta fiscal */}
          {alert && (
            <section className="px-6 py-5">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="h-1 w-1 rounded-full bg-slate-400" />
                Status fiscal
              </h4>
              <div
                className={`rounded-lg border px-4 py-3 ${
                  alert.nivel === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <p className="font-semibold">{alert.nivel === "error" ? "Erro" : "Aviso"}</p>
                {alert.descricao && <p className="mt-1 text-sm">{alert.descricao}</p>}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
