"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthHeaders } from "@/lib/auth-client";
import type { Client } from "@/contexts/client-context";

type HeaderEditModalProps = {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export default function HeaderEditModal({
  client,
  open,
  onOpenChange,
  onSaved,
}: HeaderEditModalProps) {
  const [endereco, setEndereco] = useState("");
  const [contato, setContato] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && client) {
      setEndereco(client.endereco ?? "");
      setContato(client.contato ?? "");
      setResponsavel(client.responsavel ?? "");
      setError(null);
    }
  }, [open, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client?.id) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          endereco: endereco.trim() || null,
          contato: contato.trim() || null,
          responsavel: responsavel.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dados do cabeçalho</DialogTitle>
          <DialogDescription>
            Preencha os dados que aparecem no cabeçalho das exportações (CSV, Excel e PDF). 
            Esses valores ficam salvos como padrão para a empresa {client.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Ex: Rua Exemplo, 123, Centro, Cidade/UF CEP 00.000-000"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="contato">Contato</Label>
            <Input
              id="contato"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="Ex: nome do contato ou telefone"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="responsavel">Responsável</Label>
            <Input
              id="responsavel"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Ex: nome do responsável"
              className="mt-1"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
