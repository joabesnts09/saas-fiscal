"use client";

import AppSidebar from "@/components/app-sidebar";
import AuthGuard from "@/components/auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-slate-950">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
      </div>
    </AuthGuard>
  );
}
