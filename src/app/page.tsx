"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { BadgeCheck, AlertTriangle, FileSpreadsheet, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MOCK_STATS = [
  { title: "Total faturado", value: "R$ 184.364,87", change: "116 notas autorizadas", icon: Wallet, iconClass: "bg-emerald-100 text-emerald-600" },
  { title: "Notas processadas", value: "119", change: "XMLs importados", icon: FileSpreadsheet, iconClass: "bg-blue-100 text-blue-600" },
  { title: "Prestação pendente", value: "R$ 182.013,67", change: "116 notas sem relatório", icon: BadgeCheck, iconClass: "bg-amber-100 text-amber-600" },
  { title: "Inconsistências", value: "3 alertas", change: "Notas canceladas", icon: AlertTriangle, iconClass: "bg-rose-100 text-rose-600" },
];

const MOCK_CHART_DATA = [
  { mes: "Jan", total: 42000 },
  { mes: "Fev", total: 58000 },
  { mes: "Mar", total: 45000 },
  { mes: "Abr", total: 62000 },
  { mes: "Mai", total: 78000 },
  { mes: "Jun", total: 55000 },
  { mes: "Jul", total: 68000 },
  { mes: "Ago", total: 72000 },
  { mes: "Set", total: 81000 },
  { mes: "Out", total: 95000 },
  { mes: "Nov", total: 88000 },
  { mes: "Dez", total: 102000 },
];

const MOCK_PRESTACAO_DATA = [
  { name: "Pendentes", value: 116, fill: "#eab308" },
  { name: "Inconsistências", value: 3, fill: "#ef4444" },
];

const MOCK_TOP5_PRODUTOS = [
  { name: "QUEIJO MUSSARELA - 2VL", total: 87334.56 },
  { name: "REQUEIJÃO VALE DO PARDO 1,80...", total: 21854.16 },
  { name: "LANCHE - 1VL", total: 14137.95 },
  { name: "REQUEIJÃO MILK TOP 1,8 KGS -...", total: 13659.23 },
  { name: "BACON CUBO 1 KG - 2VL", total: 9303.91 },
];

const MOCK_NOTES = [
  { data: "28/02/2023", chave: "532302...35301", numero: "3460", valor: "R$ 736,20", status: "Autorizada", itens: "18.25 itens (BACON EXTRA PALETA - 1VL; LANCH...)" },
  { data: "28/02/2023", chave: "532302...35255", numero: "3455", valor: "R$ 399,68", status: "Autorizada", itens: "22.4 itens (REQUEIJÃO MILK TOP 1,8 KGS - 1VL; ...)" },
  { data: "27/02/2023", chave: "532302...35102", numero: "3448", valor: "R$ 1.245,90", status: "Autorizada", itens: "45.2 itens (ARROZ TIPO 1 - 5KG; FEIJÃO CARIOCA...)" },
  { data: "26/02/2023", chave: "532302...34988", numero: "3441", valor: "R$ 567,30", status: "Autorizada", itens: "12.1 itens (ÓLEO SOJA - 900ML; AÇÚCAR CRISTAL...)" },
  { data: "25/02/2023", chave: "532302...34855", numero: "3435", valor: "R$ 2.118,45", status: "Autorizada", itens: "89.5 itens (LEITE INTEGRAL - 1L; MARGARINA...)" },
  { data: "24/02/2023", chave: "532302...34712", numero: "3429", valor: "R$ 890,00", status: "Autorizada", itens: "33.8 itens (CAFÉ TORRADO - 500G; BISCOITO...)" },
];

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" || (typeof window !== "undefined" && !!localStorage.getItem("fiscal_flow_token"));

  useEffect(() => {
    if (status === "loading") return;
    if (isLoggedIn) {
      router.replace("/empresas");
    }
  }, [status, isLoggedIn, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto overflow-x-hidden bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600">
              <FileSpreadsheet className="size-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Fiscal Flow</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link href="/login">Cadastrar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Gestão de notas fiscais simplificada
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Importe XMLs, gere relatórios e preste contas em um só lugar
          </p>
        </div>

        <div className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Visão geral (demonstração)</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {MOCK_STATS.map((stat) => (
              <Card key={stat.title} className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm font-medium text-slate-500">{stat.title}</CardTitle>
                  <div className={`flex size-9 items-center justify-center rounded-full ${stat.iconClass}`}>
                    <stat.icon className="size-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
                  <p className="mt-2 text-xs text-slate-500">{stat.change}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Relatórios analíticos</h2>
          <div className="mb-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Faturamento mensal</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={MOCK_CHART_DATA} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis
                      tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : String(v))}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      domain={[0, 110000]}
                    />
                    <Tooltip
                      formatter={(v) => [formatCurrency(Number(v) || 0), "Faturamento"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                    <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line type="monotone" dataKey="total" stroke="#059669" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Prestação e Inconsistências</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={MOCK_PRESTACAO_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {MOCK_PRESTACAO_DATA.map((entry, i) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} notas`, name]} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Top 5 Produtos</h3>
              <ul className="space-y-2">
                {MOCK_TOP5_PRODUTOS.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                  >
                    <span className="truncate text-sm text-slate-800">
                      {item.name.length > 28 ? `${item.name.slice(0, 28)}...` : item.name}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-emerald-700">
                      {formatCurrency(item.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Notas fiscais do mês</h2>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Exemplo de notas importadas</CardTitle>
              <p className="text-sm text-slate-500">Faça login para ver seus dados reais</p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Chave</TableHead>
                    <TableHead>NF-e/NFC-e</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_NOTES.map((row, i) => (
                    <TableRow key={i} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">{row.data}</TableCell>
                      <TableCell className="text-sm text-slate-500">{row.chave}</TableCell>
                      <TableCell>{row.numero}</TableCell>
                      <TableCell>{row.valor}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-right text-sm text-slate-600">
                        {row.itens}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 flex flex-col items-center gap-6 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 py-12 text-center">
          <p className="text-lg font-medium text-slate-800">Pronto para começar?</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button size="lg" asChild>
              <Link href="/login">Cadastrar</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
