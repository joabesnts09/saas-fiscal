import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendVerificationCode } from "@/lib/email";

const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, cnpj, email, password, confirmPassword } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Nome ou razão social da empresa é obrigatório" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "E-mail inválido" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Senha é obrigatória" },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Senha deve ter no mínimo 8 caracteres" },
        { status: 400 }
      );
    }
    if (!/[a-zA-Z]/.test(password)) {
      return NextResponse.json(
        { error: "Senha deve conter pelo menos uma letra" },
        { status: 400 }
      );
    }
    if (!/\d/.test(password)) {
      return NextResponse.json(
        { error: "Senha deve conter pelo menos um número" },
        { status: 400 }
      );
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
      return NextResponse.json(
        { error: "Senha deve conter pelo menos um caractere especial (!@#$%^&* etc.)" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "As senhas não coincidem" },
        { status: 400 }
      );
    }

    const cnpjClean = cnpj ? onlyDigits(String(cnpj)) : null;
    if (cnpjClean && cnpjClean.length !== 14) {
      return NextResponse.json(
        { error: "CNPJ inválido" },
        { status: 400 }
      );
    }

    const existingEmail = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: "Este e-mail já está cadastrado" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const code = generateCode();

    const account = await prisma.account.create({
      data: {
        name: name.trim(),
        cnpj: cnpjClean || null,
        plan: "pro",
      },
    });

    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
        role: "admin",
        accountId: account.id,
      },
    });

    await prisma.verificationCode.deleteMany({
      where: { email: email.trim().toLowerCase(), type: "signup" },
    });

    await prisma.verificationCode.create({
      data: {
        email: email.trim().toLowerCase(),
        code,
        type: "signup",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    try {
      await sendVerificationCode(email.trim().toLowerCase(), code);
    } catch (e) {
      console.error("Erro ao enviar email:", e);
      await prisma.$transaction([
        prisma.user.delete({ where: { id: user.id } }),
        prisma.account.delete({ where: { id: account.id } }),
      ]);
      return NextResponse.json(
        { error: "Falha ao enviar e-mail. Tente novamente." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      email: email.trim().toLowerCase(),
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Erro ao processar cadastro" },
      { status: 500 }
    );
  }
}
