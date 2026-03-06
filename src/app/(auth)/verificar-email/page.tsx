"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_TOKEN_KEY } from "@/lib/auth";

function VerificarEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (emailParam) setEmail(decodeURIComponent(emailParam));
  }, [emailParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Código inválido. Tente novamente.");
        setLoading(false);
        return;
      }

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      router.replace("/");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setError("Informe seu e-mail para reenviar o código.");
      return;
    }
    setResendSuccess(false);
    setResendLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao reenviar");
      } else {
        setResendSuccess(true);
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-6">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-800">
              <Mail className="size-9 text-emerald-400" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Verifique seu e-mail
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Enviamos um código de 6 dígitos para{" "}
                <span className="font-medium text-white">{email || "seu e-mail"}</span>.
                Digite-o abaixo para ativar sua conta.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code" className="text-slate-300">
                Código de verificação
              </Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                maxLength={6}
                className="border-slate-700 bg-slate-800/50 text-center text-2xl tracking-[0.5em] text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                required
              />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-emerald-600 py-6 text-base font-semibold hover:bg-emerald-500"
              disabled={loading || code.length !== 6}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-5 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Verificar e entrar"
              )}
            </Button>
            <p className="text-center text-sm text-slate-400">
              Não recebeu o código?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="text-emerald-400 hover:underline disabled:opacity-50"
              >
                {resendLoading ? "Enviando..." : "Reenviar código"}
              </button>
              {resendSuccess && (
                <span className="ml-2 text-emerald-400">Enviado!</span>
              )}
            </p>
          </form>
          <p className="mt-6 text-center text-sm text-slate-400">
            <Link href="/login" className="text-emerald-400 hover:underline">
              Voltar ao login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <VerificarEmailForm />
    </Suspense>
  );
}
