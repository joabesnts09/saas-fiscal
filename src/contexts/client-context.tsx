"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getAuthHeaders } from "@/lib/auth-client";

export type Client = {
  id: string;
  name: string;
  cnpj: string | null;
  endereco?: string | null;
  contato?: string | null;
  responsavel?: string | null;
};

type ClientContextType = {
  clients: Client[];
  selectedClient: Client | null;
  setSelectedClientId: (id: string | null) => void;
  loading: boolean;
  refetch: () => Promise<void>;
};

const ClientContext = createContext<ClientContextType | null>(null);

const SELECTED_CLIENT_KEY = "fiscal_flow_selected_client";

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients", { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setClients(data);
      setSelectedClientIdState((prev) => {
        const saved = localStorage.getItem(SELECTED_CLIENT_KEY);
        if (saved && data.some((c: Client) => c.id === saved)) return saved;
        if (data.length > 0 && !prev) {
          localStorage.setItem(SELECTED_CLIENT_KEY, data[0].id);
          return data[0].id;
        }
        return prev;
      });
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const setSelectedClientId = useCallback((id: string | null) => {
    setSelectedClientIdState(id);
    if (id) {
      localStorage.setItem(SELECTED_CLIENT_KEY, id);
    } else {
      localStorage.removeItem(SELECTED_CLIENT_KEY);
    }
  }, []);

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  return (
    <ClientContext.Provider
      value={{
        clients,
        selectedClient,
        setSelectedClientId,
        loading,
        refetch: fetchClients,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) {
    throw new Error("useClient must be used within ClientProvider");
  }
  return ctx;
}
