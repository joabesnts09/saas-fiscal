"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, summarizeItems, type NfeRecord } from "@/lib/nfe";

type NotesTableViewProps = {
  records: NfeRecord[];
  onSelectRecord?: (record: NfeRecord) => void;
};

export default function NotesTableView({ records, onSelectRecord }: NotesTableViewProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base">Notas do mês selecionado</CardTitle>
        <p className="text-sm text-slate-500">Somente visualização</p>
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
              <TableHead className="text-right">Itens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                  Nenhuma nota no mês selecionado.
                </TableCell>
              </TableRow>
            ) : (
              records.map((row) => (
                <TableRow
                  key={row.chave}
                  className={onSelectRecord ? "cursor-pointer hover:bg-slate-50" : ""}
                  onClick={() => onSelectRecord?.(row)}
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
