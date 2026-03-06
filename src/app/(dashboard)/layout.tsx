"use client";

import AppSidebar from "@/components/app-sidebar";
import AuthGuard from "@/components/auth-guard";
import { ClientProvider } from "@/contexts/client-context";
import { NotesProvider } from "@/contexts/notes-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ClientProvider>
        <NotesProvider>
          <div className="flex h-screen w-full bg-slate-950">
            <AppSidebar />
            <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
          </div>
        </NotesProvider>
      </ClientProvider>
    </AuthGuard>
  );
}
