"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Settings,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useClient } from "@/contexts/client-context";
import { getAuthHeaders } from "@/lib/auth-client";
import { useConfirm } from "@/components/confirm-dialog";
import { toast } from "@/lib/toast";

function formatCnpj(cnpj: string | null) {
  if (!cnpj) return "—";
  const s = String(cnpj).replace(/\D/g, "");
  if (s.length !== 14) return cnpj;
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
}

type ClientDetail = {
  id: string;
  name: string;
  cnpj: string | null;
  createdAt: string;
  notasCount: number;
  prestacaoCount: number;
};

const getQuickLinks = (clientId: string) => [
  { icon: LayoutDashboard, label: "Dashboard", href: `/empresas/${clientId}/dashboard`, description: "Visão geral e estatísticas" },
  { icon: FileText, label: "Notas cadastradas", href: `/empresas/${clientId}/documentos`, description: "Importar e gerenciar NF-e" },
  { icon: FileSpreadsheet, label: "Relatórios", href: `/empresas/${clientId}/relatorios`, description: "Prestação e exportação" },
  { icon: TrendingUp, label: "Melhor produto", href: `/empresas/${clientId}/documentos`, description: "Análise por produto (em breve)" },
  { icon: Settings, label: "Configurações", href: "/configuracoes", description: "Dados e preferências da empresa" },
];

export default function EmpresaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const { setSelectedClientId, refetch } = useClient();
  const router = useRouter();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useConfirm();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (!resolvedParams?.id) return;
    const id = resolvedParams.id;
    setSelectedClientId(id);
    setLoading(true);
    setError(null);
    fetch(`/api/clients/${id}`, { headers: getAuthHeaders(), credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Cliente não encontrado");
        return res.json();
      })
      .then(setClient)
      .catch(() => setError("Erro ao carregar dados"))
      .finally(() => setLoading(false));
  }, [resolvedParams?.id, setSelectedClientId]);

  const handleDelete = async () => {
    if (!client) return;
    const confirmed = await confirm({
      title: "Excluir empresa",
      description: `Excluir a empresa "${client.name}"? Todas as notas fiscais vinculadas também serão excluídas. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Empresa excluída com sucesso.");
        await refetch();
        router.replace("/empresas");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Erro ao excluir empresa");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setDeleting(false);
    }
  };

  if (!resolvedParams) return null;
  if (loading && !client) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }
  if (error || !client) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Link
          href="/empresas"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600"
        >
          <ArrowLeft className="size-4" />
          Voltar às empresas
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error ?? "Cliente não encontrado."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Link
        href="/empresas"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600"
      >
        <ArrowLeft className="size-4" />
        Voltar às empresas
      </Link>

      <div className="mb-8 flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-xl bg-emerald-100">
          <Building2 className="size-7 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
          <p className="mt-1 text-slate-600">CNPJ: {formatCnpj(client.cnpj)}</p>
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
              {client.notasCount} notas cadastradas
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              {client.prestacaoCount} na prestação
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:opacity-50"
          title="Excluir empresa"
        >
          {deleting ? (
            <span className="inline-block size-5 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
          ) : (
            <Trash2 className="size-5" />
          )}
        </button>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-slate-900">Acesso rápido</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {getQuickLinks(client.id).map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100">
              <item.icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 group-hover:text-emerald-700">
                {item.label}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">{item.description}</p>
            </div>
            <ExternalLink className="size-4 shrink-0 text-slate-400 group-hover:text-emerald-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}
