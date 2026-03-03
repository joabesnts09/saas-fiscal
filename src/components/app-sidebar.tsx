"use client";

import {
  Building2,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AUTH_TOKEN_KEY } from "@/lib/auth";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: FileText, label: "Documentos fiscais" },
  { icon: Building2, label: "Empresas" },
  { icon: FileSpreadsheet, label: "Relatórios" },
  { icon: Settings, label: "Configurações" },
  { icon: LifeBuoy, label: "Suporte" },
];

export default function AppSidebar() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside className="relative h-screen w-[260px] shrink-0 border-r-2 border-emerald-900/50 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 px-6 py-8 text-slate-100 shadow-xl shadow-black/20">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/40 px-3 py-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 shadow-inner">
          <FileSpreadsheet className="size-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-300">Fiscal Flow</p>
          <p className="text-xs text-emerald-200/70">Notas & Prestação de contas</p>
        </div>
      </div>

      <nav className="mt-10 space-y-1.5 text-sm">
        {navItems.map((item) => (
          <button
            key={item.label}
            className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-slate-300 transition hover:border-emerald-500/30 hover:bg-emerald-950/30 hover:text-emerald-100"
            type="button"
          >
            <item.icon className="size-4 text-emerald-400/80" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="absolute bottom-8 left-6 right-6">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm text-slate-400 transition hover:border-rose-500/30 hover:bg-rose-950/20 hover:text-rose-300"
        >
          <LogOut className="size-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
