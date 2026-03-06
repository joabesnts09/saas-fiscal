"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getAuthHeaders } from "@/lib/auth-client";
import type { NfeRecord } from "@/lib/nfe";
import { toast } from "@/lib/toast";
import { useClient } from "@/contexts/client-context";

const IMPORT_BATCH_SIZE = 20;
const IMPORT_PARALLEL_BATCHES = 2;

export type UploadProgress = { sent: number; total: number } | null;

type NotesContextType = {
  records: NfeRecord[];
  includedMap: Record<string, boolean>;
  loading: boolean;
  uploadProgress: UploadProgress;
  addRecords: (records: NfeRecord[]) => Promise<void>;
  setIncludedMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setRecords: React.Dispatch<React.SetStateAction<NfeRecord[]>>;
  updateRecord: (chave: string, record: Partial<NfeRecord>) => Promise<void>;
  deleteRecord: (chave: string) => Promise<boolean>;
  deleteByMonth: (month: string) => Promise<number>;
  updateIncluded: (chave: string, value: boolean) => void;
  refetch: () => Promise<void>;
};

const NotesContext = createContext<NotesContextType | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const { selectedClient } = useClient();
  const [records, setRecords] = useState<NfeRecord[]>([]);
  const [includedMap, setIncludedMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>(null);
  const prestacaoSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNotes = useCallback(async () => {
    if (!selectedClient?.id) {
      setRecords([]);
      setIncludedMap({});
      return;
    }
    setLoading(true);
    try {
      const [notesRes, prestRes] = await Promise.all([
        fetch(`/api/clients/${selectedClient.id}/notes`, { headers: getAuthHeaders() }),
        fetch(`/api/clients/${selectedClient.id}/prestacao`, { headers: getAuthHeaders() }),
      ]);
      if (notesRes.ok) {
        const data = await notesRes.json();
        setRecords(Array.isArray(data) ? data : []);
      }
      if (prestRes.ok) {
        const prest = await prestRes.json();
        setIncludedMap(prest.includedMap ?? Object.fromEntries((prest.chaves ?? []).map((c: string) => [c, true])));
      }
    } catch (e) {
      console.error("Erro ao carregar notas:", e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClient?.id]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addRecords = useCallback(async (newRecords: NfeRecord[]) => {
    if (!selectedClient?.id || newRecords.length === 0) return;
    setUploadProgress({ sent: 0, total: newRecords.length });
    try {
      let totalSaved = 0;
      let totalCnpjMismatch = 0;
      let totalDuplicates = 0;
      const batches: NfeRecord[][] = [];
      for (let i = 0; i < newRecords.length; i += IMPORT_BATCH_SIZE) {
        batches.push(newRecords.slice(i, i + IMPORT_BATCH_SIZE));
      }
      for (let i = 0; i < batches.length; i += IMPORT_PARALLEL_BATCHES) {
        const chunk = batches.slice(i, i + IMPORT_PARALLEL_BATCHES);
        const promises = chunk.map(async (batch) => {
          const res = await fetch(`/api/clients/${selectedClient.id}/notes`, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "include",
            body: JSON.stringify(batch),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error ?? "Erro ao importar notas");
          }
          return res.json();
        });
        const results = await Promise.all(promises);
        for (const data of results) {
          totalSaved += data?.saved ?? 0;
          totalCnpjMismatch += data?.cnpjMismatchCount ?? 0;
          totalDuplicates += data?.duplicateCount ?? 0;
        }
        const sent = Math.min((i + chunk.length) * IMPORT_BATCH_SIZE, newRecords.length);
        setUploadProgress({ sent, total: newRecords.length });
      }
      await fetchNotes();
      const newCount = totalSaved - totalDuplicates;
      if (newCount > 0) {
        toast.success(`${newCount} nota(s) importada(s) com sucesso.`);
      }
      if (totalDuplicates > 0) {
        toast.warning(
          `${totalDuplicates} nota(s) duplicada(s) — já existiam no sistema e não foram importadas novamente.`
        );
      }
      if (totalCnpjMismatch > 0) {
        toast.warning(
          `${totalCnpjMismatch} nota(s) com CNPJ diferente da empresa foram marcadas como inconsistência.`
        );
      }
    } catch (e) {
      console.error("Erro ao salvar notas:", e);
      toast.error(e instanceof Error ? e.message : "Erro ao importar notas");
    } finally {
      setUploadProgress(null);
    }
  }, [selectedClient?.id, fetchNotes]);

  const updateRecord = useCallback(async (chave: string, updates: Partial<NfeRecord>) => {
    if (!selectedClient?.id) return;
    try {
      const res = await fetch(`/api/clients/${selectedClient.id}/notes`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ chave, ...updates }),
      });
      if (res.ok) {
        setRecords((prev) => prev.map((r) => (r.chave === chave ? { ...r, ...updates } : r)));
      }
    } catch (e) {
      console.error("Erro ao atualizar nota:", e);
    }
  }, [selectedClient?.id]);

  const deleteRecord = useCallback(
    async (chave: string): Promise<boolean> => {
      if (!selectedClient?.id) return false;
      try {
        const res = await fetch(`/api/clients/${selectedClient.id}/notes`, {
          method: "DELETE",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify({ chave }),
        });
        if (res.ok) {
          await fetchNotes();
          return true;
        }
      } catch (e) {
        console.error("Erro ao excluir nota:", e);
      }
      return false;
    },
    [selectedClient?.id, fetchNotes]
  );

  const deleteByMonth = useCallback(
    async (month: string): Promise<number> => {
      if (!selectedClient?.id) return 0;
      try {
        const res = await fetch(
          `/api/clients/${selectedClient.id}/notes?month=${encodeURIComponent(month)}`,
          { method: "DELETE", headers: getAuthHeaders(), credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          const count = data.deleted ?? 0;
          await fetchNotes();
          return count;
        }
      } catch (e) {
        console.error("Erro ao excluir notas do mês:", e);
      }
      return 0;
    },
    [selectedClient?.id, fetchNotes]
  );

  const syncPrestacao = useCallback((map: Record<string, boolean>) => {
    if (!selectedClient?.id) return;
    const chaves = Object.keys(map).filter((k) => map[k]);
    fetch(`/api/clients/${selectedClient.id}/prestacao`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ chaves }),
    }).catch((e) => console.error("Erro ao salvar prestação:", e));
  }, [selectedClient?.id]);

  useEffect(() => {
    if (!selectedClient?.id) return;
    if (prestacaoSyncRef.current) clearTimeout(prestacaoSyncRef.current);
    prestacaoSyncRef.current = setTimeout(() => {
      syncPrestacao(includedMap);
      prestacaoSyncRef.current = null;
    }, 500);
    return () => {
      if (prestacaoSyncRef.current) clearTimeout(prestacaoSyncRef.current);
    };
  }, [includedMap, selectedClient?.id, syncPrestacao]);

  const updateIncluded = useCallback((chave: string, value: boolean) => {
    setIncludedMap((prev) => ({ ...prev, [chave]: value }));
  }, []);

  return (
    <NotesContext.Provider
      value={{
        records,
        includedMap,
        loading,
        uploadProgress,
        addRecords,
        setIncludedMap,
        setRecords,
        updateRecord,
        deleteRecord,
        deleteByMonth,
        updateIncluded,
        refetch: fetchNotes,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) {
    throw new Error("useNotes must be used within NotesProvider");
  }
  return ctx;
}
