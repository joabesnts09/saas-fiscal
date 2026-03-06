import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendVerificationCode } from "@/lib/email";

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "E-mail inválido" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "E-mail não encontrado" },
        { status: 404 }
      );
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json(
        { error: "E-mail já verificado. Faça login." },
        { status: 400 }
      );
    }

    const code = generateCode();

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

    await sendVerificationCode(email.trim().toLowerCase(), code);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Resend code error:", error);
    return NextResponse.json(
      { error: "Erro ao reenviar código" },
      { status: 500 }
    );
  }
}
