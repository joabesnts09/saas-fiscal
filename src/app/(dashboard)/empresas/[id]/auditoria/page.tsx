"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ClientSelector from "@/components/client-selector";
import { useClient } from "@/contexts/client-context";
import { getAuthHeaders } from "@/lib/auth-client";
import { formatCurrency, formatDate } from "@/lib/nfe";
import { toast } from "@/lib/toast";

type FiscalAlertRow = {
  id: string;
  chave: string;
  itemIndex: number | null;
  productId: string | null;
  tipo: string;
  descricao: string;
  nivel: string;
  detalhes: string | null;
  createdAt: string;
};

const TIPO_LABEL: Record<string, string> = {
  divergencia_icms: "Divergência de ICMS",
  ncm_invalido: "NCM inválido",
  cest_obrigatorio: "CEST obrigatório",
  cst_icms_incompativel: "CST/ICMS incompatível",
  bebida_icms_zerado: "Bebida com ICMS zerado",
};

function getTipoLabel(tipo: string): string {
  return TIPO_LABEL[tipo] ?? tipo;
}

function calculateScore(alerts: FiscalAlertRow[]): number {
  let score = 100;
  for (const a of alerts) {
    if (a.nivel === "error") score -= 10;
    else if (a.nivel === "warning") score -= 3;
    else if (a.nivel === "info") score -= 1;
  }
  return Math.max(0, Math.min(100, score));
}

export default function AuditoriaFiscalPage() {
  const params = useParams();
  const clientId = params?.id as string | undefined;
  const { clients, selectedClient } = useClient();
  const client = selectedClient ?? clients.find((c) => c.id === clientId) ?? null;

  const [alerts, setAlerts] = useState<FiscalAlertRow[]>([]);
  const [stats, setStats] = useState<{
    notesCount: number;
    itemsCount: number;
    itemsWithFiscalData: number;
    totalICMS: number;
    totalPIS: number;
    totalCOFINS: number;
    topCfops: { cfop: string; count: number }[];
    hasFiscalData: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [nivelFilter, setNivelFilter] = useState<string>("all");

  const fetchStats = useCallback(async () => {
    if (!clientId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/fiscal-stats`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        setStats(null);
      }
    } catch {
      setStats(null);
    }
  }, [clientId]);

  const fetchAlerts = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/fiscal-alerts`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar alertas");
      const data = await res.json();
      setAlerts(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar alertas fiscais");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const handleReanalisar = async () => {
    if (!clientId) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/fiscal-alerts`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao analisar");
      const data = await res.json();
      toast.success(`${data.analyzed} notas analisadas. ${data.alertsCount} alertas encontrados.`);
      await Promise.all([fetchAlerts(), fetchStats()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reanalisar");
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchStats();
  }, [fetchAlerts, fetchStats]);

  const filteredAlerts =
    nivelFilter === "all"
      ? alerts
      : alerts.filter((a) => a.nivel === nivelFilter);

  const errorCount = alerts.filter((a) => a.nivel === "error").length;
  const warningCount = alerts.filter((a) => a.nivel === "warning").length;
  const infoCount = alerts.filter((a) => a.nivel === "info").length;
  const score = calculateScore(alerts);

  if (!clientId) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-bold text-slate-900">Auditoria fiscal</h1>
        <p className="mt-1 text-slate-600">Selecione uma empresa para ver a auditoria.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Empresa: {client?.name ?? "..."}</p>
          <h1 className="text-2xl font-bold text-slate-900">Auditoria fiscal</h1>
          <p className="mt-1 text-slate-600">
            Inconsistências detectadas, tributos e validações fiscais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ClientSelector />
          <Button
            variant="outline"
            onClick={handleReanalisar}
            disabled={analyzing}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            {analyzing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Reanalisar notas
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Score fiscal
                </CardTitle>
                <div
                  className={`flex size-9 items-center justify-center rounded-full ${
                    score >= 80 ? "bg-emerald-100 text-emerald-600" : score >= 50 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                  }`}
                >
                  <ShieldCheck className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{score}/100</p>
                <p className="mt-1 text-xs text-slate-500">
                  {score >= 80 ? "Bom" : score >= 50 ? "Atenção" : "Requer correções"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Erros
                </CardTitle>
                <div className="flex size-9 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <AlertCircle className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{errorCount}</p>
                <p className="mt-1 text-xs text-slate-500">Críticos</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Avisos
                </CardTitle>
                <div className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertTriangle className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{warningCount}</p>
                <p className="mt-1 text-xs text-slate-500">Verificar</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Informações
                </CardTitle>
                <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <CheckCircle2 className="size-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{infoCount}</p>
                <p className="mt-1 text-xs text-slate-500">Observações</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{alerts.length}</p>
                <p className="mt-1 text-xs text-slate-500">Alertas detectados</p>
              </CardContent>
            </Card>
          </div>

          {stats && (
            <Card className="mb-6 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5" />
                  Resumo da análise
                </CardTitle>
                <p className="text-sm text-slate-500">
                  {stats.notesCount > 0
                    ? `Dados extraídos de ${stats.notesCount} nota(s) e ${stats.itemsCount} item(ns)`
                    : "Nenhuma nota importada. Importe XMLs em Documentos fiscais para iniciar a análise."}
                </p>
              </CardHeader>
              <CardContent>
                {stats.notesCount === 0 ? (
                  <p className="text-sm text-slate-600">
                    Importe XMLs de notas fiscais em Documentos fiscais para ter dados para análise.
                  </p>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <FileText className="size-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Notas analisadas</p>
                        <p className="text-xl font-semibold text-slate-900">{stats.notesCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                      <div>
                        <p className="text-xs text-slate-500">Itens analisados</p>
                        <p className="text-xl font-semibold text-slate-900">{stats.itemsCount}</p>
                      </div>
                    </div>
                    {stats.hasFiscalData && (
                      <>
                        <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                          <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <TrendingUp className="size-5" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">ICMS total</p>
                            <p className="text-xl font-semibold text-slate-900">{formatCurrency(stats.totalICMS)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                          <div>
                            <p className="text-xs text-slate-500">PIS + COFINS</p>
                            <p className="text-xl font-semibold text-slate-900">{formatCurrency(stats.totalPIS + stats.totalCOFINS)}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {stats.notesCount > 0 && stats.hasFiscalData && stats.topCfops.length > 0 ? (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-slate-700">CFOPs mais utilizados</p>
                    <div className="flex flex-wrap gap-2">
                      {stats.topCfops.map(({ cfop, count }) => (
                        <Badge key={cfop} variant="outline" className="border-slate-200 bg-white">
                          {cfop}: {count} itens
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {!stats.hasFiscalData && stats.notesCount > 0 && stats.itemsCount > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                    <p className="text-sm text-amber-800">
                      As notas foram importadas antes da análise fiscal. Para habilitar a auditoria completa (ICMS, PIS, COFINS, NCM, CFOP), 
                      reimporte os XMLs em Documentos fiscais.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Inconsistências detectadas</CardTitle>
              <div className="flex gap-2">
                {(["all", "error", "warning", "info"] as const).map((n) => (
                  <Button
                    key={n}
                    variant={nivelFilter === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNivelFilter(n)}
                  >
                    {n === "all" ? "Todos" : n === "error" ? "Erros" : n === "warning" ? "Avisos" : "Info"}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {filteredAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShieldCheck className="mb-4 size-12 text-emerald-500" />
                  <p className="font-medium text-slate-700">Nenhuma inconsistência encontrada</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {alerts.length === 0
                      ? "Clique em &quot;Reanalisar notas&quot; para executar a auditoria nas notas importadas."
                      : "Nenhum alerta corresponde ao filtro selecionado."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chave</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Nível</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAlerts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs text-slate-600">
                            {a.chave.slice(0, 20)}...
                          </TableCell>
                          <TableCell>
                            {a.itemIndex != null ? `#${a.itemIndex + 1}` : "-"}
                            {a.productId && (
                              <span className="ml-1 text-slate-500">({a.productId})</span>
                            )}
                          </TableCell>
                          <TableCell>{getTipoLabel(a.tipo)}</TableCell>
                          <TableCell className="max-w-[320px] truncate" title={a.descricao}>
                            {a.descricao}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                a.nivel === "error"
                                  ? "border-rose-300 bg-rose-50 text-rose-700"
                                  : a.nivel === "warning"
                                    ? "border-amber-300 bg-amber-50 text-amber-700"
                                    : "border-blue-300 bg-blue-50 text-blue-700"
                              }
                            >
                              {a.nivel === "error" ? "Erro" : a.nivel === "warning" ? "Aviso" : "Info"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">{formatDate(a.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
