"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AUTH_TOKEN_KEY } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const isLoginPage = pathname === "/login";

    if (!token && !isLoginPage) {
      router.replace("/login");
      return;
    }

    if (token && isLoginPage) {
      router.replace("/");
      return;
    }

    setReady(true);
  }, [pathname, router]);

  if (!ready && pathname !== "/login") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
