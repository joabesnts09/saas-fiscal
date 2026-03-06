"use client";

import { LifeBuoy } from "lucide-react";

export default function SuportePage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Suporte</h1>
        <p className="mt-1 text-slate-600">
          Central de ajuda e contato
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 py-16 text-center">
        <LifeBuoy className="mb-4 size-12 text-slate-400" />
        <p className="text-slate-600">Página em construção</p>
        <p className="mt-1 text-sm text-slate-500">
          Em breve: FAQ, documentação e canal de contato
        </p>
      </div>
    </div>
  );
}
