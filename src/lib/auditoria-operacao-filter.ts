import type { NfeRecord } from "@/lib/nfe";

/**
 * Mesma regra da tabela de auditoria: filtra itens por venda / compra / todos.
 * Usado no export (busca completa) e na própria tabela.
 */
export function filterNfeRecordsByOperacao(
  records: NfeRecord[],
  operacaoFilter: "todos" | "venda" | "compra",
  clientCnpj: string | null | undefined
): NfeRecord[] {
  if (operacaoFilter === "todos") {
    return records;
  }
  const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
  const cc = onlyDigits(clientCnpj);
  const byChave = new Map<string, number[]>();
  for (const r of records) {
    const tipo = (r.tipo ?? "outro") as string;
    r.itens.forEach((item, idx) => {
      const destCnpjRaw = r.destinatario?.cnpj?.trim() && r.destinatario.cnpj !== "—" ? r.destinatario.cnpj : null;
      const destCnpj =
        destCnpjRaw ?? ((tipo === "compra" || tipo === "outro") && clientCnpj && cc.length === 14 ? clientCnpj : null);
      const ec = onlyDigits(r.emitente?.cnpj);
      const dc = onlyDigits(destCnpj ?? r.destinatario?.cnpj);
      const displayTipo: "compra" | "venda" | "outro" =
        tipo === "compra" || tipo === "venda"
          ? (tipo as "compra" | "venda")
          : cc && (ec === cc || dc === cc)
            ? ec === cc
              ? "venda"
              : "compra"
            : "outro";
      if (displayTipo !== operacaoFilter) {
        return;
      }
      const arr = byChave.get(r.chave) ?? [];
      arr.push(idx);
      byChave.set(r.chave, arr);
    });
  }
  const result: NfeRecord[] = [];
  for (const r of records) {
    const indices = byChave.get(r.chave);
    if (!indices?.length) {
      continue;
    }
    const itens = r.itens.filter((_, i) => indices.includes(i));
    if (itens.length === 0) {
      continue;
    }
    result.push({ ...r, itens });
  }
  return result;
}
