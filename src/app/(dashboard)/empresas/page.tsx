"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useClient } from "@/contexts/client-context";
import { getAuthHeaders } from "@/lib/auth-client";
import { useConfirm } from "@/components/confirm-dialog";
import { toast } from "@/lib/toast";

function formatCnpj(cnpj: string | null) {
  if (!cnpj) return "—";
  const s = cnpj.replace(/\D/g, "");
  if (s.length !== 14) return cnpj;
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
}

export default function EmpresasPage() {
  const router = useRouter();
  const { confirm } = useConfirm();
  const { clients, selectedClient, loading: clientsLoading, refetch } = useClient();
  const { data: session } = useSession();
  const plan = (session as { plan?: string } | null)?.plan ?? "free";
  const canAddMore = plan !== "free" || clients.length < 1;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), cnpj: cnpj.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar cliente");
        return;
      }
      setName("");
      setCnpj("");
      setOpen(false);
      await refetch();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, clientId: string, clientName: string) => {
    e.preventDefault();
    e.stopPropagation();
    const confirmed = await confirm({
      title: "Excluir empresa",
      description: `Excluir a empresa "${clientName}"? Todas as notas fiscais vinculadas também serão excluídas. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!confirmed) return;
    setDeletingId(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Erro ao excluir empresa");
        return;
      }
      toast.success("Empresa excluída com sucesso.");
      await refetch();
      if (selectedClient?.id === clientId) {
        router.replace("/empresas");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
          <p className="mt-1 text-slate-600">
            Clientes do escritório (empresas que você gerencia)
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => canAddMore && setOpen(v)}>
          <DialogTrigger asChild>
            <Button disabled={!canAddMore} title={!canAddMore ? "Plano Free permite apenas 1 empresa" : undefined}>
              <Plus className="mr-2 size-4" />
              Nova empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar empresa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome fantasia ou razão social</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Mercado São João"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value.replace(/\D/g, "").slice(0, 14))}
                  placeholder="Somente números"
                  className="mt-1"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {clientsLoading ? (
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i}>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div className="flex flex-1 items-center gap-4 min-w-0">
                  <Skeleton className="size-10 shrink-0 rounded-xl" />
                  <div className="min-w-0 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-14 rounded-full" />
                  <Skeleton className="size-9 rounded-lg" />
                  <Skeleton className="size-4 rounded" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 py-16 text-center">
          <Building2 className="mb-4 size-12 text-slate-400" />
          <p className="text-slate-600">Nenhuma empresa cadastrada</p>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre a primeira empresa para começar a importar notas
          </p>
          <Button className="mt-6" onClick={() => canAddMore && setOpen(true)} disabled={!canAddMore}>
            <Plus className="mr-2 size-4" />
            Nova empresa
          </Button>
        </div>
      ) : (
        <>
          {error && (
            <p className="mb-4 text-sm text-rose-600">{error}</p>
          )}
          <ul className="space-y-3">
            {clients.map((client) => {
              const isSelected = selectedClient?.id === client.id;
              const isDeleting = deletingId === client.id;
              return (
                <li key={client.id}>
                  <Link
                    href={`/empresas/${client.id}/dashboard`}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-5 py-4 shadow-sm transition ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/80 shadow-emerald-200/50 ring-2 ring-emerald-400/30"
                        : "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex flex-1 items-center gap-4 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                        <Building2 className="size-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{client.name}</p>
                        <p className="text-sm text-slate-500">
                          CNPJ: {formatCnpj(client.cnpj)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected && (
                        <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
                          Selecionada
                        </span>
                      )}
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${isSelected ? "bg-emerald-200 text-emerald-800" : "bg-emerald-100 text-emerald-700"}`}>
                        Ativo
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, client.id, client.name)}
                        disabled={isDeleting}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:opacity-50"
                        title="Excluir empresa"
                      >
                        {isDeleting ? (
                          <span className="inline-block size-5 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
                        ) : (
                          <Trash2 className="size-5" />
                        )}
                      </button>
                      <ChevronRight className="size-4 text-slate-400" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
