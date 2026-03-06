"use client";

import { Toaster } from "sonner";
import { SessionProvider } from "next-auth/react";
import { type ReactNode } from "react";
import { ConfirmProvider } from "@/components/confirm-dialog";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmProvider>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </ConfirmProvider>
    </SessionProvider>
  );
}
