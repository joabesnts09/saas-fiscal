import { useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, type NfeRecord } from "@/lib/nfe";
import { toast } from "@/lib/toast";
import { Trash2 } from "lucide-react";

type NoteDetailsDialogProps = {
  record: NfeRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (chave: string, updates: Partial<NfeRecord>) => void;
  onDelete?: (chave: string) => Promise<boolean>;
};

export default function NoteDetailsDialog({
  record,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: NoteDetailsDialogProps) {
  const { confirm } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [editValor, setEditValor] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!record) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const handleStartEdit = () => {
    setEditValor(String(record.valorTotal).replace(".", ","));
    setEditing(true);
  };

  const handleSaveEdit = () => {
    const val = Number.parseFloat(editValor.replace(",", "."));
    if (!Number.isNaN(val) && onSave) {
      onSave(record.chave, { valorTotal: val });
      setEditing(false);
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const confirmed = await confirm({
      title: "Excluir nota",
      description: "Excluir esta nota? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      const ok = await onDelete(record.chave);
      if (ok) {
        toast.success("Nota excluída com sucesso.");
        onOpenChange(false);
      } else {
        toast.error("Erro ao excluir nota.");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhe da nota {record.numero}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-400">Chave</p>
            <p className="break-all text-slate-900">{record.chave}</p>
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
            {editing ? (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={editValor}
                  onChange={(e) => setEditValor(e.target.value)}
                  placeholder="0,00"
                  className="max-w-[140px]"
                />
                <Button size="sm" onClick={handleSaveEdit}>Salvar</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-slate-900">{formatCurrency(record.valorTotal)}</p>
                {onSave && (
                  <Button size="sm" variant="ghost" onClick={handleStartEdit}>
                    Editar
                  </Button>
                )}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Itens</p>
            <p className="text-slate-900">{record.itens.length}</p>
          </div>
          {onDelete && (
            <div className="sm:col-span-2 flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="mr-2 size-4" />
                {deleting ? "Excluindo..." : "Excluir nota"}
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID produto</TableHead>
                <TableHead className="text-right">Descrição</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {record.itens.map((item, index) => (
                <TableRow key={`${record.chave}-${index}`}>
                  <TableCell>{item.productId || "-"}</TableCell>
                  <TableCell className="max-w-[280px] text-right">
                  <span className="block truncate text-right" title={item.description}>
                    {item.description}
                  </span>
                </TableCell>
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
