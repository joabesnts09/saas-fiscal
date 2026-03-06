import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fiscal-flow-secret-key-dev"
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: "E-mail e código são obrigatórios" },
        { status: 400 }
      );
    }

    const verification = await prisma.verificationCode.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        type: "signup",
        code: String(code).trim(),
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verification) {
      return NextResponse.json(
        { error: "Código inválido" },
        { status: 400 }
      );
    }

    if (verification.expiresAt < new Date()) {
      await prisma.verificationCode.delete({ where: { id: verification.id } });
      return NextResponse.json(
        { error: "Código expirado. Solicite um novo cadastro." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
      include: { account: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.verificationCode.delete({ where: { id: verification.id } }),
    ]);

    const token = await new SignJWT({
      userId: user.id,
      accountId: user.accountId,
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("6h")
      .sign(JWT_SECRET);

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "Erro ao verificar código" },
      { status: 500 }
    );
  }
}
