import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultiSelectFilter from "./multi-select-filter";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { formatCurrency, formatDate, summarizeItems, type NfeRecord } from "@/lib/nfe";

export type NotesTableCompany = { cnpj: string; razaoSocial: string };
export type NotesTableFilters = {
  status: "all" | "Autorizada" | "Cancelada";
  company: string;
  productIds: string[];
  descriptions: string[];
  cests: string[];
  minValue: string;
  maxValue: string;
  month: string;
};
export type NotesTableFilterHandlers = {
  setStatus: (value: "all" | "Autorizada" | "Cancelada") => void;
  setCompany: (value: string) => void;
  setProductIds: (value: string[]) => void;
  setDescriptions: (value: string[]) => void;
  setCests: (value: string[]) => void;
  setMinValue: (value: string) => void;
  setMaxValue: (value: string) => void;
  setMonth: (value: string) => void;
};

type NotesTableProps = {
  records: NfeRecord[];
  includedMap: Record<string, boolean>;
  onToggleIncluded: (chave: string, value: boolean) => void;
  onSelectRecord: (record: NfeRecord) => void;
  companies: NotesTableCompany[];
  productIds: string[];
  descriptions: string[];
  cests: string[];
  filters: NotesTableFilters;
  onFiltersChange: NotesTableFilterHandlers;
  onToggleAll: (value: boolean) => void;
  allSelected: boolean;
  onDeleteMonth?: () => void;
  deleteMonthLoading?: boolean;
  monthOptions: { value: string; label: string }[];
  loading?: boolean;
};

export default function NotesTable({
  records,
  includedMap,
  onToggleIncluded,
  onSelectRecord,
  companies,
  productIds,
  descriptions,
  cests,
  filters,
  onFiltersChange,
  onToggleAll,
  allSelected,
  onDeleteMonth,
  deleteMonthLoading,
  monthOptions,
  loading,
}: NotesTableProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-col gap-4 border-b border-slate-200 pb-4">
        <div className="flex w-full items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Notas fiscais do período</CardTitle>
            <p className="text-sm text-slate-500">
              Importadas automaticamente via XML (NF-e/NFC-e).
            </p>
          </div>
          {onDeleteMonth && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              onClick={onDeleteMonth}
              disabled={deleteMonthLoading}
            >
              <Trash2 className="size-4" />
              {deleteMonthLoading ? "Excluindo..." : "Excluir mês"}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid gap-2">
            <Label className="text-xs text-slate-500">Empresa</Label>
            <Select value={filters.company} onValueChange={onFiltersChange.setCompany}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.cnpj} value={company.cnpj}>
                    {company.razaoSocial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-slate-500">Mês</Label>
            {monthOptions.length === 0 ? (
              <div className="flex h-9 w-[180px] items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                Nenhum mês disponível
              </div>
            ) : (
              <Select value={filters.month || monthOptions[0]?.value} onValueChange={onFiltersChange.setMonth}>
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
            )}
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-slate-500">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => onFiltersChange.setStatus(value as "all" | "Autorizada" | "Cancelada")}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Autorizada">Autorizada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-slate-500">Valor (min / máx)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="0"
                value={filters.minValue}
                onChange={(event) => onFiltersChange.setMinValue(event.target.value)}
              />
              <Input
                type="number"
                placeholder="99999"
                value={filters.maxValue}
                onChange={(event) => onFiltersChange.setMaxValue(event.target.value)}
              />
            </div>
          </div>
          <MultiSelectFilter
            label="ID do produto"
            options={productIds}
            selected={filters.productIds}
            onSelectionChange={onFiltersChange.setProductIds}
            placeholder="Todos"
          />
          <MultiSelectFilter
            label="Descrição"
            options={descriptions}
            selected={filters.descriptions}
            onSelectionChange={onFiltersChange.setDescriptions}
            placeholder="Todas"
            formatOption={(v) => (v.length > 40 ? `${v.slice(0, 40)}...` : v)}
          />
          <MultiSelectFilter
            label="CEST"
            options={cests}
            selected={filters.cests}
            onSelectionChange={onFiltersChange.setCests}
            placeholder="Todos"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Chave</TableHead>
              <TableHead>NF-e/NFC-e</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>ID Produto</TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(value) => onToggleAll(Boolean(value))}
                  />
                  <span>Prestação</span>
                </div>
              </TableHead>
              <TableHead className="text-right">Itens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-14" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right"><Skeleton className="inline-block h-4 w-32" /></TableCell>
                </TableRow>
              ))
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                  Faça upload dos XMLs para visualizar as notas.
                </TableCell>
              </TableRow>
            ) : (
              records.map((row) => (
                <TableRow
                key={row.chave}
                className="cursor-pointer transition-colors hover:bg-slate-50"
                onClick={() => onSelectRecord(row)}
              >
                  <TableCell className="font-medium">{formatDate(row.dataEmissao)}</TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {row.chave.slice(0, 6)}...{row.chave.slice(-5)}
                  </TableCell>
                  <TableCell>{row.numero}</TableCell>
                  <TableCell>{formatCurrency(row.valorTotal)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={row.status === "Autorizada" ? "secondary" : "destructive"}>
                        {row.status}
                      </Badge>
                      {row.cnpjMismatch && row.tipo === "venda" && (
                        <Badge variant="outline" className="border-amber-400 text-amber-700 text-xs">
                          CNPJ divergente
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {row.itens[0]?.productId || "-"}
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={Boolean(includedMap[row.chave])}
                        onCheckedChange={(value) => onToggleIncluded(row.chave, Boolean(value))}
                      />
                      <span className="text-xs text-slate-500">Incluída</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[220px] text-right">
                    <span
                      className="block truncate text-right"
                      title={summarizeItems(row.itens)}
                    >
                      {summarizeItems(row.itens)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
