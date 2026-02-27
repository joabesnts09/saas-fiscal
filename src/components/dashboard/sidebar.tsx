import {
  Building2,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type SidebarProps = {
  count: number;
  uploadState: "idle" | "loading";
  importSummary: {
    total: number;
    success: number;
    failed: string[];
  } | null;
};

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: FileText, label: "Documentos fiscais" },
  { icon: Building2, label: "Empresas" },
  { icon: FileSpreadsheet, label: "Relatórios" },
  { icon: Settings, label: "Configurações" },
  { icon: LifeBuoy, label: "Suporte" },
];

export default function Sidebar({ count, uploadState, importSummary }: SidebarProps) {
  return (
    <aside className="border-b border-slate-800 bg-slate-950 px-6 py-8 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-900">
          <FileSpreadsheet className="size-5 text-emerald-300" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-300">Fiscal Flow</p>
          <p className="text-xs text-slate-400">Notas & Prestação de contas</p>
        </div>
      </div>

      <nav className="mt-10 space-y-2 text-sm">
        {navItems.map((item) => (
          <button
            key={item.label}
            className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left text-slate-300 transition hover:border-slate-800 hover:bg-slate-900/60 hover:text-slate-100"
            type="button"
          >
            <item.icon className="size-4 text-slate-400" />
            {item.label}
          </button>
        ))}
      </nav>

      <Separator className="my-8 bg-slate-800" />

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs text-slate-400">Status do processamento</p>
        <p className="mt-2 text-sm font-semibold text-white">{count} XMLs processados</p>
        <p className="mt-1 text-xs text-slate-400">
          {uploadState === "loading" ? "Importando..." : "Pronto para importar"}
        </p>
        {importSummary && (
          <p className="mt-2 text-xs text-slate-400">
            Última importação: {importSummary.success}/{importSummary.total} OK
            {importSummary.failed.length > 0 ? ` · ${importSummary.failed.length} falhas` : ""}
          </p>
        )}
        <Button className="mt-4 w-full" variant="secondary">
          Ver fila de importação
        </Button>
      </div>
    </aside>
  );
}
