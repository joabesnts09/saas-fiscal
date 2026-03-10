"use client";

import {
  Building2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Settings,
  Shield,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useClient } from "@/contexts/client-context";
import { getCurrentUser } from "@/lib/auth-client";
import { AUTH_TOKEN_KEY } from "@/lib/auth";

const getNavItems = (clientId: string | null, isSuperadmin: boolean) => [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: clientId ? `/empresas/${clientId}/dashboard` : "/empresas",
    isActive: (path: string) => /^\/empresas\/[^/]+\/dashboard\/?$/.test(path ?? ""),
  },
  {
    icon: FileText,
    label: "Documentos fiscais",
    href: clientId ? `/empresas/${clientId}/documentos` : "/empresas",
    isActive: (path: string) => /^\/empresas\/[^/]+\/documentos/.test(path ?? ""),
  },
  {
    icon: ShieldCheck,
    label: "Auditoria fiscal",
    href: clientId ? `/empresas/${clientId}/auditoria` : "/empresas",
    isActive: (path: string) => /^\/empresas\/[^/]+\/auditoria/.test(path ?? ""),
  },
  {
    icon: Building2,
    label: "Empresas",
    href: "/empresas",
    isActive: (path: string) => path === "/empresas" || path === "/empresas/",
  },
  {
    icon: FileSpreadsheet,
    label: "Relatórios",
    href: clientId ? `/empresas/${clientId}/relatorios` : "/empresas",
    isActive: (path: string) => /^\/empresas\/[^/]+\/relatorios/.test(path ?? ""),
  },
  {
    icon: Settings,
    label: "Configurações",
    href: "/configuracoes",
    isActive: (path: string) => (path ?? "").startsWith("/configuracoes"),
  },
  {
    icon: LifeBuoy,
    label: "Suporte",
    href: "/suporte",
    isActive: (path: string) => (path ?? "").startsWith("/suporte"),
  },
  ...(isSuperadmin
    ? [
        {
          icon: Shield,
          label: "Admin",
          href: "/admin",
          isActive: (path: string) => (path ?? "").startsWith("/admin"),
        },
      ]
    : []),
];

export default function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedClient } = useClient();
  const { data: session } = useSession();
  const tokenUser = getCurrentUser();
  const sessionRole = (session as { role?: string } | null)?.role;
  const plan = (session as { plan?: string } | null)?.plan ?? "free";
  const isSuperadmin = sessionRole === "superadmin" || tokenUser?.role === "superadmin";
  const planLabel = plan === "pro" ? "Pro" : plan === "enterprise" ? "Enterprise" : "Free";
  const clientIdMatch = pathname?.match(/^\/empresas\/([^/]+)/);
  const clientIdFromUrl = clientIdMatch?.[1] ?? null;
  const clientId = clientIdFromUrl ?? selectedClient?.id ?? null;
  const navItems = getNavItems(clientId, isSuperadmin);

  const handleLogout = async () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    if (session) {
      await signOut({ callbackUrl: "/login", redirect: false });
    }
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside className="relative z-10 flex h-screen w-[260px] shrink-0 flex-col border-r-2 border-emerald-900/50 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 px-6 py-8 text-slate-100 shadow-xl shadow-black/20">
      <Link
        href={clientId ? `/empresas/${clientId}` : "/empresas"}
        className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/40 px-3 py-3 transition hover:border-emerald-500/30 hover:bg-emerald-950/50"
      >
        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 shadow-inner">
          <FileSpreadsheet className="size-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-300">Fiscal Flow</p>
          <p className="text-xs text-emerald-200/70">Notas & Prestação de contas</p>
        </div>
      </Link>

      <nav className="mt-10 space-y-1.5 text-sm">
        {navItems.map((item) => {
          const isActive = item.isActive(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                isActive
                  ? "border-emerald-500/40 bg-emerald-950/50 text-emerald-100"
                  : "border-transparent text-slate-300 hover:border-emerald-500/30 hover:bg-emerald-950/30 hover:text-emerald-100"
              }`}
            >
              <item.icon className="size-4 text-emerald-400/80" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-8 left-6 right-6 space-y-2">
        <Link
          href="/planos"
          className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
            plan === "free"
              ? pathname?.startsWith("/planos")
                ? "border-slate-500/50 bg-slate-800/60 text-slate-200"
                : "border-slate-600/30 bg-slate-800/40 text-slate-400 hover:border-slate-500/50 hover:bg-slate-800/60 hover:text-slate-200"
              : pathname?.startsWith("/planos")
                ? "border-emerald-500/40 bg-emerald-950/50 text-emerald-100"
                : "border-emerald-500/20 bg-emerald-950/30 text-slate-300 hover:border-emerald-500/30 hover:bg-emerald-950/50 hover:text-emerald-100"
          }`}
        >
          <CreditCard
            className={`size-4 ${plan === "free" ? "text-slate-400" : "text-emerald-400/80"}`}
          />
          <div className="min-w-0 flex-1">
            <p
              className={`text-xs ${plan === "free" ? "text-slate-500" : "text-emerald-200/70"}`}
            >
              Plano atual
            </p>
            <p className="font-medium truncate">{planLabel}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm text-slate-400 transition hover:border-rose-500/30 hover:bg-rose-950/20 hover:text-rose-300"
        >
          <LogOut className="size-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
