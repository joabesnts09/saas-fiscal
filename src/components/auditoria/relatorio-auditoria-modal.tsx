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
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { generateParecerAutomatico, type FiscalAlertLike } from "@/lib/auditoria-parecer-generator";

export type RelatorioAuditoriaFormData = {
  statusAuditoria: "em_analise" | "concluida" | "revisada";
  nivelRisco: "baixo" | "medio" | "alto";
  scoreFiscal: number;
  notasAnalisadas: number;
  erros: number;
  avisos: number;
  conclusao: string;
  recomendacoes: string;
  responsavelNome: string;
  responsavelCrc: string;
  dataParecer: string;
};

const STATUS_OPTS = [
  { value: "em_analise" as const, label: "Em análise" },
  { value: "concluida" as const, label: "Concluída" },
  { value: "revisada" as const, label: "Revisada" },
];

const RISCO_OPTS = [
  { value: "baixo" as const, label: "Baixo" },
  { value: "medio" as const, label: "Médio" },
  { value: "alto" as const, label: "Alto" },
];

function labelStatus(v: RelatorioAuditoriaFormData["statusAuditoria"]) {
  return STATUS_OPTS.find((o) => o.value === v)?.label ?? v;
}

function labelRisco(v: RelatorioAuditoriaFormData["nivelRisco"]) {
  return RISCO_OPTS.find((o) => o.value === v)?.label ?? v;
}

export function formatRelatorioForCsv(data: RelatorioAuditoriaFormData): string {
  const lines = [
    "RELATÓRIO DE AUDITORIA FISCAL",
    "",
    "1. Status da auditoria",
    labelStatus(data.statusAuditoria),
    "",
    "2. Nível de risco",
    labelRisco(data.nivelRisco),
    "",
    "3. Resumo automático",
    `Score fiscal: ${data.scoreFiscal}/100`,
    `Notas analisadas: ${data.notasAnalisadas}`,
    `Erros: ${data.erros}`,
    `Avisos: ${data.avisos}`,
    "",
    "4. Conclusão da auditoria",
    data.conclusao || "—",
    "",
    "5. Recomendações fiscais",
    data.recomendacoes || "—",
    "",
    "6. Responsável",
    `Nome: ${data.responsavelNome || "—"}`,
    `CRC: ${data.responsavelCrc || "—"}`,
    "",
    "7. Data do parecer",
    data.dataParecer,
    "",
    "---",
    "",
  ];
  return lines.join("\n");
}

export function relatorioRowsForXlsx(data: RelatorioAuditoriaFormData): (string | number)[][] {
  return [
    ["RELATÓRIO DE AUDITORIA FISCAL"],
    [],
    ["1. Status da auditoria", labelStatus(data.statusAuditoria)],
    ["2. Nível de risco", labelRisco(data.nivelRisco)],
    [],
    ["3. Resumo automático"],
    ["Score fiscal", `${data.scoreFiscal}/100`],
    ["Notas analisadas", data.notasAnalisadas],
    ["Erros", data.erros],
    ["Avisos", data.avisos],
    [],
    ["4. Conclusão da auditoria"],
    [data.conclusao || "—"],
    [],
    ["5. Recomendações fiscais"],
    [data.recomendacoes || "—"],
    [],
    ["6. Responsável"],
    ["Nome", data.responsavelNome || "—"],
    ["CRC", data.responsavelCrc || "—"],
    [],
    ["7. Data do parecer", data.dataParecer],
    [],
    [],
  ];
}

export function formatRelatorioHtmlBlock(data: RelatorioAuditoriaFormData, escapeHtml: (s: string) => string): string {
  const nl = (s: string) => escapeHtml(s).replace(/\n/g, "<br />");
  return `
<section style="margin-bottom:28px;padding:16px;border:1px solid #0d9488;background:#f0fdfa;border-radius:8px">
  <h2 style="margin:0 0 12px;font-size:16px;color:#0f766e">Relatório de Auditoria Fiscal</h2>
  <table style="width:100%;font-size:12px;border-collapse:collapse">
    <tr><td style="padding:4px 8px 4px 0;font-weight:600;color:#334155">Status da auditoria</td><td>${escapeHtml(labelStatus(data.statusAuditoria))}</td></tr>
    <tr><td style="padding:4px 8px 4px 0;font-weight:600;color:#334155">Nível de risco</td><td>${escapeHtml(labelRisco(data.nivelRisco))}</td></tr>
  </table>
  <p style="margin:12px 0 4px;font-weight:600;color:#334155">Resumo automático</p>
  <ul style="margin:0;padding-left:20px;line-height:1.6">
    <li>Score fiscal: <strong>${data.scoreFiscal}/100</strong></li>
    <li>Notas analisadas: <strong>${data.notasAnalisadas}</strong></li>
    <li>Erros: <strong>${data.erros}</strong></li>
    <li>Avisos: <strong>${data.avisos}</strong></li>
  </ul>
  <p style="margin:12px 0 4px;font-weight:600;color:#334155">Conclusão da auditoria</p>
  <div style="padding:8px;background:#fff;border:1px solid #e2e8f0;border-radius:4px;white-space:pre-wrap">${nl(data.conclusao || "—")}</div>
  <p style="margin:12px 0 4px;font-weight:600;color:#334155">Recomendações fiscais</p>
  <div style="padding:8px;background:#fff;border:1px solid #e2e8f0;border-radius:4px;white-space:pre-wrap">${nl(data.recomendacoes || "—")}</div>
  <p style="margin:12px 0 4px;font-size:12px"><strong>Responsável:</strong> ${escapeHtml(data.responsavelNome || "—")}${data.responsavelCrc ? ` · CRC: ${escapeHtml(data.responsavelCrc)}` : ""}</p>
  <p style="margin:4px 0 0;font-size:12px"><strong>Data do parecer:</strong> ${escapeHtml(data.dataParecer)}</p>
</section>
<hr style="border:1px solid #ddd;margin:20px 0" />
`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportFormatLabel: string;
  summary: {
    score: number;
    notasAnalisadas: number;
    erros: number;
    avisos: number;
  };
  /** Alertas das notas em análise, usados para gerar parecer automático */
  alerts: FiscalAlertLike[];
  defaultResponsavel: string;
  onConfirm: (data: RelatorioAuditoriaFormData) => void;
};

export default function RelatorioAuditoriaModal({
  open,
  onOpenChange,
  exportFormatLabel,
  summary,
  alerts,
  defaultResponsavel,
  onConfirm,
}: Props) {
  const [statusAuditoria, setStatusAuditoria] = useState<RelatorioAuditoriaFormData["statusAuditoria"]>("em_analise");
  const [nivelRisco, setNivelRisco] = useState<RelatorioAuditoriaFormData["nivelRisco"]>("baixo");
  const [conclusao, setConclusao] = useState("");
  const [recomendacoes, setRecomendacoes] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelCrc, setResponsavelCrc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setResponsavelNome(defaultResponsavel.trim());
      setResponsavelCrc("");
    }
  }, [open, defaultResponsavel]);

  const dataParecer = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const handleSubmit = () => {
    setSubmitting(true);
    try {
      onConfirm({
        statusAuditoria,
        nivelRisco,
        scoreFiscal: summary.score,
        notasAnalisadas: summary.notasAnalisadas,
        erros: summary.erros,
        avisos: summary.avisos,
        conclusao: conclusao.trim(),
        recomendacoes: recomendacoes.trim(),
        responsavelNome: responsavelNome.trim(),
        responsavelCrc: responsavelCrc.trim(),
        dataParecer,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Relatório de Auditoria Fiscal</DialogTitle>
          <DialogDescription>
            Preencha o parecer antes de exportar em <strong>{exportFormatLabel}</strong>. O resumo numérico reflete o período selecionado na tela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <Label className="text-sm font-medium">1. Status da auditoria</Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {STATUS_OPTS.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="status-aud"
                    checked={statusAuditoria === o.value}
                    onChange={() => setStatusAuditoria(o.value)}
                    className="size-4 accent-emerald-600"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">2. Nível de risco</Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {RISCO_OPTS.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="risco"
                    checked={nivelRisco === o.value}
                    onChange={() => setNivelRisco(o.value)}
                    className="size-4 accent-emerald-600"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-700">3. Resumo automático</p>
            <ul className="mt-2 space-y-1 text-slate-600">
              <li>Score fiscal: <strong>{summary.score}/100</strong></li>
              <li>Notas analisadas: <strong>{summary.notasAnalisadas}</strong></li>
              <li>Erros: <strong>{summary.erros}</strong></li>
              <li>Avisos: <strong>{summary.avisos}</strong></li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-2 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
              onClick={() => {
                const parecer = generateParecerAutomatico(alerts, summary.notasAnalisadas);
                setConclusao(parecer.conclusao);
                setRecomendacoes(parecer.recomendacoes);
                setStatusAuditoria(parecer.statusSugerido);
                setNivelRisco(parecer.nivelRiscoSugerido);
              }}
            >
              <Sparkles className="size-4" />
              Gerar parecer automático
            </Button>
            <p className="text-xs text-slate-500">
              Preenche conclusão, recomendações, status e nível de risco com base nas inconsistências detectadas.
            </p>
          </div>

          <div>
            <Label htmlFor="conclusao" className="text-sm font-medium">
              4. Conclusão da auditoria
            </Label>
            <textarea
              id="conclusao"
              rows={4}
              value={conclusao}
              onChange={(e) => setConclusao(e.target.value)}
              placeholder="Descreva a conclusão do contador sobre a auditoria fiscal..."
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div>
            <Label htmlFor="recomendacoes" className="text-sm font-medium">
              5. Recomendações fiscais
            </Label>
            <textarea
              id="recomendacoes"
              rows={3}
              value={recomendacoes}
              onChange={(e) => setRecomendacoes(e.target.value)}
              placeholder="Ex.: Revisar NCM dos produtos; Validar regras de CFOP..."
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="resp-nome" className="text-sm font-medium">
                6. Responsável (nome)
              </Label>
              <input
                id="resp-nome"
                type="text"
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                placeholder="Nome do contador"
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="resp-crc" className="text-sm font-medium">
                CRC (opcional)
              </Label>
              <input
                id="resp-crc"
                type="text"
                value={responsavelCrc}
                onChange={(e) => setResponsavelCrc(e.target.value)}
                placeholder="Número CRC"
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600">
            <span className="font-medium text-slate-700">7. Data do parecer:</span> {dataParecer}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Exportar {exportFormatLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
