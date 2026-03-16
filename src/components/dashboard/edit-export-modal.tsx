"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAuthHeaders } from "@/lib/auth-client";
import {
  DEFAULT_EXPORT_FIELDS,
  EXPORT_FIELD_KEYS,
  EXPORT_FIELD_LABELS,
  type ExportFieldKey,
} from "@/lib/export-config";
import { ChevronLeft, ChevronRight, GripVertical, Loader2, X } from "lucide-react";
import { toast } from "@/lib/toast";

type EditExportModalProps = {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (fields: ExportFieldKey[]) => void;
};

const DATA_AVAILABLE = "export-available-field";
const DATA_SELECTED_INDEX = "export-selected-index";

export default function EditExportModal({
  clientId,
  open,
  onOpenChange,
  onSaved,
}: EditExportModalProps) {
  const [selectedFields, setSelectedFields] = useState<ExportFieldKey[]>(() => [...DEFAULT_EXPORT_FIELDS]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeFieldIndex, setActiveFieldIndex] = useState<number | null>(null);

  const availableFields = EXPORT_FIELD_KEYS.filter((k) => !selectedFields.includes(k));

  useEffect(() => {
    if (open && clientId) {
      setLoading(true);
      fetch(`/api/clients/${clientId}/export-config`, { headers: getAuthHeaders(), credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.fields) && data.fields.length > 0) {
            const valid = data.fields.filter((f: string) => EXPORT_FIELD_KEYS.includes(f as ExportFieldKey));
            if (valid.length > 0) setSelectedFields(valid as ExportFieldKey[]);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open, clientId]);

  const handleAddField = (key: ExportFieldKey, atIndex?: number) => {
    setSelectedFields((prev) => {
      const next = prev.filter((k) => k !== key);
      const idx = atIndex ?? next.length;
      next.splice(idx, 0, key);
      return next;
    });
  };

  const handleRemoveField = (index: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedFields((prev) => prev.filter((_, i) => i !== index));
    if (activeFieldIndex === index) setActiveFieldIndex(null);
    else if (activeFieldIndex != null && activeFieldIndex > index) setActiveFieldIndex(activeFieldIndex - 1);
  };

  const handleMoveField = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const clampedTo = Math.max(0, Math.min(toIndex, selectedFields.length - 1));
    setSelectedFields((prev) => {
      const arr = [...prev];
      const [removed] = arr.splice(fromIndex, 1);
      const insertAt = fromIndex < clampedTo ? clampedTo : clampedTo;
      arr.splice(Math.min(insertAt, arr.length), 0, removed!);
      return arr;
    });
    setActiveFieldIndex(clampedTo);
  };

  const handleMoveActiveLeft = () => {
    if (activeFieldIndex == null || activeFieldIndex <= 0) return;
    handleMoveField(activeFieldIndex, activeFieldIndex - 1);
  };

  const handleMoveActiveRight = () => {
    if (activeFieldIndex == null || activeFieldIndex >= selectedFields.length - 1) return;
    handleMoveField(activeFieldIndex, activeFieldIndex + 1);
  };

  const handleDragStart = (e: React.DragEvent, type: "available" | "selected", value: string | number) => {
    e.dataTransfer.setData(type === "available" ? DATA_AVAILABLE : DATA_SELECTED_INDEX, String(value));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => setDragOverIndex(null);

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const available = e.dataTransfer.getData(DATA_AVAILABLE);
    const selectedIdx = e.dataTransfer.getData(DATA_SELECTED_INDEX);
    if (available && EXPORT_FIELD_KEYS.includes(available as ExportFieldKey)) {
      handleAddField(available as ExportFieldKey, dropIndex);
    } else if (selectedIdx !== "") {
      const fromIdx = parseInt(selectedIdx, 10);
      if (!Number.isNaN(fromIdx)) handleMoveField(fromIdx, dropIndex);
    }
  };

  const handleDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);
    const available = e.dataTransfer.getData(DATA_AVAILABLE);
    const selectedIdx = e.dataTransfer.getData(DATA_SELECTED_INDEX);
    if (available && EXPORT_FIELD_KEYS.includes(available as ExportFieldKey)) {
      handleAddField(available as ExportFieldKey);
    } else if (selectedIdx !== "") {
      const fromIdx = parseInt(selectedIdx, 10);
      if (!Number.isNaN(fromIdx)) handleMoveField(fromIdx, selectedFields.length);
    }
  };

  const handleSave = async () => {
    if (!clientId || selectedFields.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/export-config`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ fields: selectedFields }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      onSaved(selectedFields);
      toast.success("Configuração de exportação salva.");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefault = () => {
    setSelectedFields([...DEFAULT_EXPORT_FIELDS]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[1400px]">
        <DialogHeader>
          <DialogTitle>Editar exportação</DialogTitle>
          <DialogDescription>
            Arraste os campos da esquerda para as colunas da tabela à direita. A ordem define as colunas do CSV, Excel e PDF. Clique no X para remover uma coluna.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="grid grid-cols-[240px_1fr] gap-6">
            {/* Painel esquerdo: campos disponíveis */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">Campos disponíveis</p>
              <div className="flex flex-col gap-1.5">
                {availableFields.map((key) => (
                  <div
                    key={key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, "available", key)}
                    className="cursor-grab rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition-shadow active:cursor-grabbing hover:shadow"
                  >
                    {EXPORT_FIELD_LABELS[key]}
                  </div>
                ))}
                {availableFields.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-500">Todos os campos já estão na tabela</p>
                )}
              </div>
            </div>

            {/* Painel direito: colunas da tabela (estilo tabela) */}
            <div className="min-w-0">
              <p className="mb-2 text-xs font-medium text-slate-500">
                Colunas da exportação — clique em um campo para selecionar (clique novamente para desmarcar)
              </p>
              <div className="min-h-[140px] rounded-lg border-2 border-dashed border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-stretch gap-2">
                  {selectedFields.map((key, index) => (
                    <div
                      key={`${key}-${index}`}
                      draggable
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setActiveFieldIndex((current) => (current === index ? null : index))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setActiveFieldIndex((current) =>
                            current === index ? null : index,
                          );
                        }
                      }}
                      onDragStart={(e) => handleDragStart(e, "selected", index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`flex min-w-[100px] cursor-grab flex-col items-center justify-between gap-1 rounded-md border px-3 py-2 text-center text-sm shadow-sm active:cursor-grabbing ${
                        activeFieldIndex === index
                          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                          : dragOverIndex === index
                            ? "border-emerald-400 bg-emerald-50"
                            : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-1">
                        <GripVertical className="size-3.5 shrink-0 text-slate-400" />
                        <button
                          type="button"
                          onClick={(e) => handleRemoveField(index, e)}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          aria-label="Remover"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <span className="w-full truncate text-xs font-medium">
                        {EXPORT_FIELD_LABELS[key]}
                      </span>
                    </div>
                  ))}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDragOverIndex(-1);
                    }}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverIndex(null);
                      handleDropZone(e);
                    }}
                    className={`flex min-w-[120px] shrink-0 items-center justify-center rounded-md border-2 border-dashed px-3 py-4 text-xs text-slate-500 ${
                      dragOverIndex === -1 ? "border-emerald-400 bg-emerald-50" : "border-slate-200"
                    }`}
                  >
                    Arraste aqui
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-wrap items-center gap-3 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleRestoreDefault} disabled={loading}>
            Restaurar padrão
          </Button>
          <div className="flex flex-1 items-center justify-end gap-2">
            {activeFieldIndex != null && selectedFields.length > 0 && (
              <>
                <span className="hidden text-xs text-slate-600 sm:inline">
                  Movendo &quot;{EXPORT_FIELD_LABELS[selectedFields[activeFieldIndex]!]}&quot;
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={handleMoveActiveLeft}
                  disabled={activeFieldIndex <= 0}
                  aria-label="Mover para a esquerda"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={handleMoveActiveRight}
                  disabled={activeFieldIndex >= selectedFields.length - 1}
                  aria-label="Mover para a direita"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading || saving || selectedFields.length === 0}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
