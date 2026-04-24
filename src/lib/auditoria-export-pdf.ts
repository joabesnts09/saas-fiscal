import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { RelatorioAuditoriaFormData } from "@/components/auditoria/relatorio-auditoria-modal";

const STATUS_LABELS: Record<string, string> = {
  em_analise: "Em análise",
  concluida: "Concluída",
  revisada: "Revisada",
};
const RISCO_LABELS: Record<string, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

/** Gera PDF do Relatório de Auditoria Fiscal */
export function generateRelatorioPdf(data: RelatorioAuditoriaFormData): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO DE AUDITORIA FISCAL", 20, y);
  y += 12;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("1. Status da auditoria", 20, y);
  doc.text(STATUS_LABELS[data.statusAuditoria] ?? data.statusAuditoria, 70, y);
  y += 8;

  doc.text("2. Nível de risco", 20, y);
  doc.text(RISCO_LABELS[data.nivelRisco] ?? data.nivelRisco, 70, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.text("3. Resumo automático", 20, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text(`Score fiscal: ${data.scoreFiscal}/100`, 25, y);
  y += 6;
  doc.text(`Notas analisadas: ${data.notasAnalisadas}`, 25, y);
  y += 6;
  doc.text(`Erros: ${data.erros}`, 25, y);
  y += 6;
  doc.text(`Avisos: ${data.avisos}`, 25, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.text("4. Conclusão da auditoria", 20, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const conclusaoLines = doc.splitTextToSize(data.conclusao || "—", 170);
  doc.text(conclusaoLines, 20, y);
  y += conclusaoLines.length * 5 + 8;

  doc.setFont("helvetica", "bold");
  doc.text("5. Recomendações fiscais", 20, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const recLines = doc.splitTextToSize(data.recomendacoes || "—", 170);
  doc.text(recLines, 20, y);
  y += recLines.length * 5 + 8;

  doc.setFont("helvetica", "bold");
  doc.text("6. Responsável", 20, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${data.responsavelNome || "—"}`, 25, y);
  y += 6;
  doc.text(`CRC: ${data.responsavelCrc || "—"}`, 25, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("7. Data do parecer", 20, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.dataParecer, 70, y);

  return doc.output("blob");
}

/** Colunas monetárias: alinhar à direita */
const CURRENCY_HEADERS = new Set(["ICMS", "Base de cálculo ICMS", "PIS", "COFINS", "Valor"]);
/** Colunas de CST/códigos: centralizar */
const CENTER_HEADERS = new Set(["CST IPI", "CST COFINS", "CST ICMS", "CST PIS", "CEST", "CBS", "IBS"]);

const LANDSCAPE_A4_WIDTH = 297;
const MARGIN = 14;
const TABLE_AVAILABLE_WIDTH = LANDSCAPE_A4_WIDTH - MARGIN * 2; // 269mm

/** Largura mínima por coluna para evitar texto vertical (1 char por linha) */
const BASE_MIN_COLUMN_WIDTH = 12;

/** Fonte e padding ajustados automaticamente conforme quantidade de colunas */
function getFontSizeForColumns(colCount: number): number {
  if (colCount <= 8) return 8;
  if (colCount <= 12) return 7;
  if (colCount <= 16) return 6;
  if (colCount <= 20) return 5;
  return 4;
}

/** Colunas que precisam de mais espaço (multiplicador de peso) */
const WIDE_COLUMN_BOOST = new Set(["Chave de acesso", "Emitente", "Destinatário", "Descrição dos itens"]);
/** Colunas com conteúdo curto - recebem peso menor mas nunca abaixo de MIN_COLUMN_WIDTH */
const NARROW_COLUMNS = new Set(["CBS", "IBS", "CEST", "CST IPI", "CST COFINS", "CST ICMS", "CST PIS"]);

/** Calcula larguras automaticamente: proporcional ao conteúdo, com mínimo para evitar texto vertical */
function getProportionalWidths(
  headers: string[],
  rows: Record<string, string | number>[],
  totalWidth: number
): number[] {
  const colCount = headers.length;
  const minWidth = Math.min(BASE_MIN_COLUMN_WIDTH, totalWidth / colCount);
  const weights = headers.map((h) => {
    const headerLen = h.length;
    let maxContentLen = 4;
    for (const row of rows) {
      const len = String(row[h] ?? "").length;
      if (len > maxContentLen) maxContentLen = len;
    }
    let weight = Math.max(headerLen, maxContentLen, 4);
    if (WIDE_COLUMN_BOOST.has(h)) weight *= 1.8;
    else if (NARROW_COLUMNS.has(h)) weight *= 0.7;
    return weight;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let widths = weights.map((w) => (sum > 0 ? (w / sum) * totalWidth : totalWidth / colCount));
  widths = widths.map((w) => (w * totalWidth) / widths.reduce((a, b) => a + b, 0));
  const belowMin = widths.map((w, i) => (w < minWidth ? i : -1)).filter((i) => i >= 0);
  if (belowMin.length > 0) {
    const deficit = belowMin.reduce((a, i) => a + (minWidth - widths[i]!), 0);
    belowMin.forEach((i) => (widths[i] = minWidth));
    const aboveMin = widths.map((w, i) => (w >= minWidth ? i : -1)).filter((i) => i >= 0);
    const aboveSum = aboveMin.reduce((a, i) => a + widths[i]!, 0);
    if (aboveSum > 0 && deficit > 0) {
      aboveMin.forEach((i) => {
        const take = (deficit * widths[i]!) / aboveSum;
        widths[i] = Math.max(minWidth, widths[i]! - take);
      });
    }
    const currentSum = widths.reduce((a, b) => a + b, 0);
    if (currentSum > 0) widths = widths.map((w) => (w * totalWidth) / currentSum);
  }
  return widths;
}

/** Gera PDF das Notas fiscais - Auditoria (tabela) - layout dinâmico 100% width */
export function generateNotasPdf(
  headers: string[],
  rows: Record<string, string | number>[],
  meta: { empresa: string; cnpj: string; endereco: string; contato: string; responsavel: string; periodo: string; totalVal: string }
): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let y = 15;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Notas fiscais - Auditoria", 14, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`EMPRESA: ${meta.empresa}`, 14, y);
  y += 5;
  doc.text(`CNPJ: ${meta.cnpj}`, 14, y);
  y += 5;
  doc.text(`ENDEREÇO: ${meta.endereco}`, 14, y);
  y += 5;
  doc.text(`CONTATO: ${meta.contato}`, 14, y);
  y += 5;
  doc.text(`RESPONSÁVEL: ${meta.responsavel}`, 14, y);
  y += 5;
  doc.text(`PERÍODO: ${meta.periodo}`, 14, y);
  y += 10;

  const colCount = headers.length;
  const fontSize = getFontSizeForColumns(colCount);
  const minCellWidth = Math.min(BASE_MIN_COLUMN_WIDTH, TABLE_AVAILABLE_WIDTH / colCount);
  const cellWidths = getProportionalWidths(headers, rows, TABLE_AVAILABLE_WIDTH);

  const columnStyles: Record<number, { halign?: "left" | "center" | "right"; cellWidth: number }> = {};
  headers.forEach((h, i) => {
    const style: { halign?: "left" | "center" | "right"; cellWidth: number } = { cellWidth: cellWidths[i]! };
    if (CURRENCY_HEADERS.has(h)) style.halign = "right";
    else if (CENTER_HEADERS.has(h)) style.halign = "center";
    columnStyles[i] = style;
  });

  const body = rows.map((row) =>
    headers.map((h) => {
      const v = row[h];
      return v == null || String(v).trim() === "" ? "—" : String(v);
    })
  );
  autoTable(doc, {
    head: [headers],
    body,
    startY: y,
    theme: "grid",
    tableWidth: TABLE_AVAILABLE_WIDTH,
    styles: {
      fontSize,
      cellPadding: colCount > 16 ? 1 : 2,
      overflow: "linebreak",
      minCellWidth,
    },
    headStyles: {
      fillColor: [243, 244, 246],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize,
      overflow: "linebreak",
      minCellWidth,
    },
    margin: { left: MARGIN, right: MARGIN },
    columnStyles,
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 20;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`VALOR TOTAL: ${meta.periodo} — ${meta.totalVal}`, 14, finalY + 10);

  return doc.output("blob");
}

/**
 * Gera PDF dos gráficos: um PNG por cartão (cada `data-auditoria-export-card`) para que
 * **não haja corte a meio** de um bloco na mudança de página.
 * Cartões muito altos encolhem para caberem numa página (em vez de serem partidos).
 */
export async function generateGraficosPdf(cardPngs: string[]): Promise<Blob> {
  const loadImage = (dataUrl: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler uma imagem de gráfico"));
      el.src = dataUrl;
    });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - 2 * margin;
  const gap = 3;

  let y = 20;
  let first = true;
  for (const dataUrl of cardPngs) {
    const img = await loadImage(dataUrl);
    const iw = Math.max(1, img.naturalWidth);
    const ih = Math.max(1, img.naturalHeight);
    let wMm = contentW;
    let hMm = (ih / iw) * wMm;

    if (first) {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Gráficos e indicadores", margin, 12);
      y = 20;
      first = false;
    }

    let available = pageH - y - margin;
    if (hMm + gap > available) {
      if (y > 20) {
        doc.addPage();
        y = 14;
        available = pageH - y - margin;
      }
    }
    if (hMm > available) {
      const s = available / hMm;
      hMm = available;
      wMm = contentW * s;
    }

    const x = margin + (contentW - wMm) / 2;
    doc.addImage(dataUrl, "PNG", x, y, wMm, hMm, undefined, "MEDIUM");
    y += hMm + gap;
  }

  return doc.output("blob");
}
