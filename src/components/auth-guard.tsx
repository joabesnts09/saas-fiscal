"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AUTH_TOKEN_KEY } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [ready, setReady] = useState(false);

  const isLoggedIn = status === "authenticated" || (typeof window !== "undefined" && localStorage.getItem(AUTH_TOKEN_KEY));

  useEffect(() => {
    const isPublicPage =
      pathname === "/login" || pathname === "/registro" || pathname === "/verificar-email";

    if (status === "loading") return;

    if (!isLoggedIn && !isPublicPage) {
      router.replace("/login");
      return;
    }

    if (isLoggedIn && isPublicPage) {
      router.replace("/empresas");
      return;
    }

    setReady(true);
  }, [pathname, router, isLoggedIn, status]);

  if (!ready && pathname !== "/login" && pathname !== "/registro" && pathname !== "/verificar-email") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
