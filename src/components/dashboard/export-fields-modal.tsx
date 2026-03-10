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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getExportFields,
  saveExportFields,
  EXPORT_FIELD_KEYS,
  EXPORT_FIELD_LABELS,
  type ExportFieldKey,
} from "@/lib/export-fields";

type ExportFieldsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export default function ExportFieldsModal({
  open,
  onOpenChange,
  onSaved,
}: ExportFieldsModalProps) {
  const [fields, setFields] = useState<Record<ExportFieldKey, boolean>>(() => getExportFields());

  useEffect(() => {
    if (open) {
      setFields(getExportFields());
    }
  }, [open]);

  const handleToggle = (key: ExportFieldKey, checked: boolean) => {
    setFields((prev) => ({ ...prev, [key]: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasAny = (Object.values(fields) as boolean[]).some(Boolean);
    if (!hasAny) return;
    saveExportFields(fields);
    onSaved?.();
    onOpenChange(false);
  };

  const hasAnySelected = (Object.values(fields) as boolean[]).some(Boolean);

  const handleReset = () => {
    const defaults: Record<ExportFieldKey, boolean> = {
      data: true,
      chave: true,
      numero: true,
      valor: true,
      itens: true,
      status: true,
      cest: true,
      ncm: true,
      cfop: true,
      baseCalculo: true,
    };
    setFields(defaults);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Campos da exportação</DialogTitle>
          <DialogDescription>
            Selecione os campos que deseja incluir nas exportações (CSV, Excel e PDF).
            Sua escolha fica salva como preferência.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3">
            {EXPORT_FIELD_KEYS.map((key) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={key}
                  checked={fields[key] ?? true}
                  onCheckedChange={(checked) => handleToggle(key, checked === true)}
                />
                <Label
                  htmlFor={key}
                  className="cursor-pointer text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {EXPORT_FIELD_LABELS[key]}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter className="flex flex-row justify-between sm:justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
              Restaurar padrão
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!hasAnySelected}>
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
