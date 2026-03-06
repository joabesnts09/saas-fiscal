"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, Shield, Loader2 } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AccountRow = {
  id: string;
  name: string;
  cnpj: string | null;
  plan: string;
  createdAt: string;
  usersCount: number;
  clientsCount: number;
};

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const role = (session as { role?: string } | null)?.role;
  const isSuperadmin = role === "superadmin";

  useEffect(() => {
    if (status === "loading") return;
    if (!isSuperadmin) {
      router.replace("/empresas");
      return;
    }

    async function fetchAccounts() {
      try {
        const res = await fetch("/api/admin/accounts", {
          headers: getAuthHeaders(),
          credentials: "include",
        });
        if (res.status === 403 || res.status === 401) {
          router.replace("/empresas");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setAccounts(data);
        }
      } catch {
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAccounts();
  }, [router, isSuperadmin, status]);

  const handlePlanChange = async (accountId: string, plan: string) => {
    setUpdating(accountId);
    try {
        const res = await fetch(`/api/admin/accounts/${accountId}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({ plan }),
        });
      if (res.ok) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === accountId ? { ...a, plan } : a))
        );
      }
    } finally {
      setUpdating(null);
    }
  };

  if (status === "loading" || !isSuperadmin) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-amber-100">
          <Shield className="size-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Painel do administrador
          </h1>
          <p className="text-sm text-slate-600">
            Gerencie contas e planos das empresas de contabilidade
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-700">
                Empresa
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">
                CNPJ
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">
                Plano
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">
                Usuários
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">
                Clientes
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr
                key={acc.id}
                className="border-b border-slate-100 hover:bg-slate-50/50"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-slate-400" />
                    <span className="font-medium text-slate-900">{acc.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {acc.cnpj
                    ? `${acc.cnpj.slice(0, 2)}.${acc.cnpj.slice(2, 5)}.${acc.cnpj.slice(5, 8)}/${acc.cnpj.slice(8, 12)}-${acc.cnpj.slice(12)}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={acc.plan}
                    onValueChange={(v) => handlePlanChange(acc.id, v)}
                    disabled={updating === acc.id}
                  >
                    <SelectTrigger className="w-[130px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                  {updating === acc.id && (
                    <Loader2 className="mt-1 inline-block size-4 animate-spin text-slate-400" />
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{acc.usersCount}</td>
                <td className="px-4 py-3 text-slate-600">{acc.clientsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {accounts.length === 0 && (
          <div className="py-12 text-center text-slate-500">
            Nenhuma conta cadastrada
          </div>
        )}
      </div>
    </div>
  );
}
