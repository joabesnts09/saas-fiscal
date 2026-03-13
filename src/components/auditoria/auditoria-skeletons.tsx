"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SummaryCardsSkeleton() {
  return (
    <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-9 rounded-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-16" />
            <Skeleton className="mt-2 h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ResumoAnalysisSkeleton() {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-6 w-12" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* ICMS por mês */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Skeleton className="mb-3 h-5 w-36" />
        <div className="flex h-[140px] items-end gap-2">
          {[70, 45, 85, 55, 65].map((pct, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${pct}%` }}
            />
          ))}
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-1 h-5 w-28" />
        </div>
      </div>

      {/* Distribuição CFOP */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Skeleton className="mb-3 h-5 w-40" />
        <div className="flex h-[140px] items-center justify-center">
          <Skeleton className="size-28 rounded-full" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-14 rounded" />
          ))}
        </div>
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <Skeleton className="h-3 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>

      {/* Top NCM + Tributos */}
      <div className="flex flex-col gap-4 md:col-span-2 lg:col-span-1">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="mb-3 h-5 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="mb-3 h-5 w-28" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
            <Skeleton className="h-px w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ItemsTableSkeleton() {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-6 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table className="table-fixed min-w-[1200px]">
            <colgroup>
              <col className="w-[90px]" />
              <col className="w-[200px]" />
              <col className="w-[200px]" />
              <col className="w-[220px]" />
              <col className="w-[100px]" />
              <col className="w-[90px]" />
              <col className="w-[70px]" />
              <col className="w-[50px]" />
              <col className="w-[95px]" />
              <col className="w-[95px]" />
              <col className="w-[85px]" />
              <col className="w-[95px]" />
              <col className="w-[70px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 13 }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }).map((_, rowIdx) => (
                <TableRow key={rowIdx}>
                  {Array.from({ length: 13 }).map((_, colIdx) => (
                    <TableCell key={colIdx}>
                      <Skeleton className={`h-4 ${[1, 2, 3].includes(colIdx) ? "w-full" : "w-14"}`} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AuditoriaSkeletons() {
  return (
    <div className="space-y-6">
      <SummaryCardsSkeleton />
      <TabsSkeleton />
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-10 rounded" />
          <Skeleton className="h-10 w-[200px] rounded-md" />
        </div>
        <ResumoAnalysisSkeleton />
        <ChartsSkeleton />
        <ItemsTableSkeleton />
      </div>
    </div>
  );
}

function TabsSkeleton() {
  return (
    <div className="mb-4 flex gap-2">
      {["Resumo e análise", "Análise por itens", "Inconsistências"].map((label) => (
        <Skeleton key={label} className="h-10 w-40 rounded-md" />
      ))}
    </div>
  );
}
