import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, type NfeRecord } from "@/lib/nfe";

type NoteDetailsDialogProps = {
  record: NfeRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function NoteDetailsDialog({
  record,
  open,
  onOpenChange,
}: NoteDetailsDialogProps) {
  if (!record) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhe da nota {record.numero}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-400">Chave</p>
            <p className="text-slate-900">{record.chave}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Data de emissão</p>
            <p className="text-slate-900">{formatDate(record.dataEmissao)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Série</p>
            <p className="text-slate-900">{record.serie}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Status</p>
            <p className="text-slate-900">{record.status}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Emitente</p>
            <p className="text-slate-900">{record.emitente.razaoSocial}</p>
            <p className="text-xs text-slate-500">CNPJ: {record.emitente.cnpj}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Valor total</p>
            <p className="text-slate-900">{formatCurrency(record.valorTotal)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Itens</p>
            <p className="text-slate-900">{record.itens.length}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {record.itens.map((item, index) => (
                <TableRow key={`${record.chave}-${index}`}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
