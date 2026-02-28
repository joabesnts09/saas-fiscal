import { Badge } from "@/components/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, summarizeItems, type NfeRecord } from "@/lib/nfe";

export type NotesTableCompany = { cnpj: string; razaoSocial: string };
export type NotesTableFilters = {
  status: "all" | "Autorizada" | "Cancelada";
  company: string;
  productId: string;
  minValue: string;
  maxValue: string;
  startDate: string;
  endDate: string;
};
export type NotesTableFilterHandlers = {
  setStatus: (value: "all" | "Autorizada" | "Cancelada") => void;
  setCompany: (value: string) => void;
  setProductId: (value: string) => void;
  setMinValue: (value: string) => void;
  setMaxValue: (value: string) => void;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
};

type NotesTableProps = {
  records: NfeRecord[];
  includedMap: Record<string, boolean>;
  onToggleIncluded: (chave: string, value: boolean) => void;
  onSelectRecord: (record: NfeRecord) => void;
  companies: NotesTableCompany[];
  productIds: string[];
  filters: NotesTableFilters;
  onFiltersChange: NotesTableFilterHandlers;
  onToggleAll: (value: boolean) => void;
  allSelected: boolean;
};

export default function NotesTable({
  records,
  includedMap,
  onToggleIncluded,
  onSelectRecord,
  companies,
  productIds,
  filters,
  onFiltersChange,
  onToggleAll,
  allSelected,
}: NotesTableProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <CardTitle className="text-base">Notas fiscais do período</CardTitle>
          <p className="text-sm text-slate-500">
            Importadas automaticamente via XML (NF-e/NFC-e).
          </p>
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
            <Label className="text-xs text-slate-500">Período</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filters.startDate}
                onChange={(event) => onFiltersChange.setStartDate(event.target.value)}
              />
              <Input
                type="date"
                value={filters.endDate}
                onChange={(event) => onFiltersChange.setEndDate(event.target.value)}
              />
            </div>
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
          <div className="grid gap-2">
            <Label className="text-xs text-slate-500">ID do produto</Label>
            <Select
              value={filters.productId}
              onValueChange={onFiltersChange.setProductId}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {productIds.map((productId) => (
                  <SelectItem key={productId} value={productId}>
                    {productId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                  Faça upload dos XMLs para visualizar as notas.
                </TableCell>
              </TableRow>
            ) : (
              records.map((row) => (
                <TableRow key={row.chave} className="cursor-pointer" onClick={() => onSelectRecord(row)}>
                  <TableCell className="font-medium">{formatDate(row.dataEmissao)}</TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {row.chave.slice(0, 6)}...{row.chave.slice(-5)}
                  </TableCell>
                  <TableCell>{row.numero}</TableCell>
                  <TableCell>{formatCurrency(row.valorTotal)}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "Autorizada" ? "secondary" : "destructive"}>
                      {row.status}
                    </Badge>
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
                  <TableCell className="text-right">{summarizeItems(row.itens)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
