import RelatoriosPage from "@/components/relatorios-page";

export default function EmpresaRelatoriosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <RelatoriosPage params={params} />;
}
