import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppSidebar from "@/components/app-sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fiscal Flow | Dashboard de Notas",
  description:
    "Plataforma para importar XML de notas fiscais, gerar planilhas e relatórios.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-screen overflow-hidden antialiased`}
        suppressHydrationWarning
      >
        <div className="flex h-screen w-full bg-slate-950">
          <AppSidebar />
          <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
        </div>
      </body>
    </html>
  );
}
