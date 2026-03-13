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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatCnpj, formatDate, type NfeRecord } from "@/lib/nfe";
import { toast } from "@/lib/toast";
import { Trash2 } from "lucide-react";

const docLabel = (doc: string) => doc.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ";

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <DialogHeader>
            <DialogTitle className="text-lg">Detalhe da nota {record.numero}</DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Dados da nota */}
          <section className="shrink-0 border-b border-slate-100 bg-white px-6 py-5">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="h-1 w-1 rounded-full bg-slate-400" />
              Dados da nota
            </h4>
            <div className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-500">Chave de acesso</span>
                <div className="select-text rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-700 break-all">
                  {record.chave}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Data de emissão</span>
                <p className="text-slate-900">{formatDate(record.dataEmissao)}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Série</span>
                <p className="text-slate-900">{record.serie}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Status</span>
                <p className="text-slate-900">{record.status}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Valor total</span>
                {editing ? (
                  <div className="flex flex-wrap items-center gap-2">
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
                    <p className="font-semibold text-slate-900">{formatCurrency(record.valorTotal)}</p>
                    {onSave && (
                      <Button size="sm" variant="ghost" onClick={handleStartEdit}>
                        Editar
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Itens</span>
                <p className="text-slate-900">{record.itens.length}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-xs font-medium text-slate-500">Emitente</span>
                <div className="mt-1 rounded-md border border-slate-100 bg-slate-50/30 px-3 py-2">
                  <p className="text-slate-900">{record.emitente.razaoSocial}</p>
                  {record.emitente.cnpj && (
                    <p className="mt-0.5 font-mono text-xs text-slate-600">
                      {docLabel(record.emitente.cnpj)}: {formatCnpj(record.emitente.cnpj)}
                    </p>
                  )}
                </div>
              </div>
              {record.destinatario && (
                <div className="sm:col-span-2">
                  <span className="text-xs font-medium text-slate-500">Destinatário</span>
                  <div className="mt-1 rounded-md border border-slate-100 bg-slate-50/30 px-3 py-2">
                    <p className="text-slate-900">{record.destinatario.razaoSocial ?? "—"}</p>
                    {record.destinatario.cnpj && record.destinatario.cnpj !== "—" && (
                      <p className="mt-0.5 font-mono text-xs text-slate-600">
                        {docLabel(record.destinatario.cnpj)}: {formatCnpj(record.destinatario.cnpj)}
                      </p>
                    )}
                  </div>
                </div>
              )}
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
          </section>

          {/* Tabela de itens */}
          <section className="shrink-0 border-t border-slate-100 bg-slate-50/30 px-6 py-5">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="h-1 w-1 rounded-full bg-slate-400" />
              Itens da nota
            </h4>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">ID produto</TableHead>
                    <TableHead className="min-w-[240px]">Descrição</TableHead>
                    <TableHead className="text-right w-28">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {record.itens.map((item, index) => (
                    <TableRow key={`${record.chave}-${index}`}>
                      <TableCell className="font-mono text-xs">{item.productId || "-"}</TableCell>
                      <TableCell className="text-sm">
                        <span className="block break-words" title={item.description}>
                          {item.description}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {item.vProd != null && item.vProd > 0 ? formatCurrency(item.vProd) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
