"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FileSpreadsheet, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AUTH_TOKEN_KEY } from "@/lib/auth";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: "Este e-mail já está cadastrado com outro método de login.",
  OAuthCallback: "Erro ao conectar com o Google. Tente novamente.",
  Default: "Erro ao entrar. Tente novamente.",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const errorCode = searchParams.get("error") ?? "";
  const error = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default) : "";

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(AUTH_TOKEN_KEY)) {
      router.replace("/empresas");
    }
  }, [router]);

  const handleGoogleSignIn = () => {
    setLoading(true);
    signIn("google", { callbackUrl: "/empresas" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4">
      <Link href="/" className="mb-6 text-sm text-slate-400 hover:text-white transition">
        ← Voltar à página inicial
      </Link>
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-6">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-800">
              <FileSpreadsheet className="size-9 text-emerald-400" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Fiscal Flow
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Notas & Prestação de contas
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            {error && (
              <p className="text-sm text-rose-400">{error}</p>
            )}
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full gap-3 bg-white py-6 text-base font-semibold text-slate-900 hover:bg-slate-100"
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <svg className="size-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Entrar com Google
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="size-8 animate-spin text-emerald-400" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
