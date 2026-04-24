"use client";

import { toPng } from "html-to-image";

export const AUDITORIA_CHART_CARD_SELECTOR = "[data-auditoria-export-card]";

/**
 * Uma captura toPng do contentor + recorte em cantos (cartões) para o PDF
 * nunca “partir” um cartão entre páginas.
 */
export async function captureAuditoriaChartCardPngs(
  container: HTMLElement,
  options: { pixelRatio?: number } = {}
): Promise<string[]> {
  const pixelRatio = options.pixelRatio ?? 2.5;
  const fullDataUrl = await toPng(container, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: "#ffffff",
  });

  const cards = Array.from(container.querySelectorAll<HTMLElement>(AUDITORIA_CHART_CARD_SELECTOR));
  if (cards.length === 0) {
    return [fullDataUrl];
  }

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Falha ao carregar a imagem de gráficos"));
    i.src = fullDataUrl;
  });

  const sh = Math.max(1, container.scrollHeight, container.offsetHeight);
  const sw = Math.max(1, container.scrollWidth, container.offsetWidth);
  const cRect = container.getBoundingClientRect();
  const out: string[] = [];

  for (const card of cards) {
    const eRect = card.getBoundingClientRect();
    const top = eRect.top - cRect.top + container.scrollTop;
    const left = eRect.left - cRect.left + container.scrollLeft;
    const w = eRect.width;
    const h = eRect.height;

    const x0 = Math.max(0, Math.floor((left / sw) * img.naturalWidth));
    const y0 = Math.max(0, Math.floor((top / sh) * img.naturalHeight));
    const wPx = Math.max(1, Math.ceil((w / sw) * img.naturalWidth));
    const hPx = Math.max(1, Math.ceil((h / sh) * img.naturalHeight));
    const x1 = Math.min(x0 + wPx, img.naturalWidth);
    const y1 = Math.min(y0 + hPx, img.naturalHeight);
    const cw = x1 - x0;
    const ch = y1 - y0;

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      out.push(fullDataUrl);
      continue;
    }
    ctx.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);
    out.push(canvas.toDataURL("image/png", 0.95));
  }

  return out;
}
