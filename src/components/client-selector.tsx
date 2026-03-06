"use client";

import { Building2, ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClient } from "@/contexts/client-context";

export default function ClientSelector() {
  const { clients, selectedClient, setSelectedClientId, loading } = useClient();
  const pathname = usePathname();
  const router = useRouter();

  const handleChange = (newClientId: string) => {
    setSelectedClientId(newClientId || null);
    const match = pathname?.match(/^\/empresas\/([^/]+)(\/.*)?$/);
    if (match) {
      const rest = match[2] || "";
      router.push(`/empresas/${newClientId}${rest}`);
    } else {
      router.push(`/empresas/${newClientId}/dashboard`);
    }
  };

  if (loading || clients.length === 0) return null;

  return (
    <Select
      value={selectedClient?.id ?? ""}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-[220px] border-emerald-200/60 bg-white">
        <Building2 className="mr-2 size-4 text-emerald-500" />
        <SelectValue placeholder="Selecione o cliente" />
        <ChevronDown className="size-4 opacity-50" />
      </SelectTrigger>
      <SelectContent>
        {clients.map((client) => (
          <SelectItem key={client.id} value={client.id}>
            {client.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
