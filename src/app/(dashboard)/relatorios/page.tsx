"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClient } from "@/contexts/client-context";

export default function RelatoriosRedirectPage() {
  const router = useRouter();
  const { clients, selectedClient, loading } = useClient();

  useEffect(() => {
    if (loading) return;
    if (selectedClient) {
      router.replace(`/empresas/${selectedClient.id}/relatorios`);
    } else if (clients.length > 0) {
      router.replace(`/empresas/${clients[0].id}/relatorios`);
    } else {
      router.replace("/empresas");
    }
  }, [loading, clients, selectedClient, router]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );
}
