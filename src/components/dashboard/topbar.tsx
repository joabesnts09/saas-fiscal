import { ArrowUpRight, Bell, Filter, Search, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type TopbarProps = {
  onFilesSelected: (files: FileList | null) => void;
  exportDisabled: boolean;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
};

type SearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function TopbarSearch({ value, onChange }: SearchProps) {
  return (
    <>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Buscar por chave ou nota"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <Button variant="outline" className="gap-2">
        <Filter className="size-4" />
        Filtros
      </Button>
    </>
  );
}

export default function Topbar({
  onFilesSelected,
  exportDisabled,
  onExportCsv,
  onExportPdf,
  onExportXlsx,
}: TopbarProps) {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Bem-vindo, Joabe</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Visão geral da prestação de contas
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="gap-2" asChild>
            <label>
              <UploadCloud className="size-4" />
              Upload XML
              <input
                type="file"
                className="hidden"
                multiple
                accept=".xml,.XML,.zip"
                onClick={(event) => {
                  (event.currentTarget as HTMLInputElement).value = "";
                }}
                onChange={(event) => onFilesSelected(event.target.files)}
              />
            </label>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2" disabled={exportDisabled}>
                Exportar
                <ArrowUpRight className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExportXlsx}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={onExportCsv}>CSV (.csv)</DropdownMenuItem>
              <DropdownMenuItem onClick={onExportPdf}>PDF (prestação de contas)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon">
            <Bell className="size-5 text-slate-500" />
          </Button>
        </div>
      </div>
    </header>
  );
}
