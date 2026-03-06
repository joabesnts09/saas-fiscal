import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fiscal-flow-secret-key-dev"
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user, password } = body;

    if (!user || !password) {
      return NextResponse.json(
        { error: "Usuário e senha são obrigatórios" },
        { status: 400 }
      );
    }

    // user pode ser email ou nome de usuário
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: user }, { email: { equals: user, mode: "insensitive" } }],
      },
      include: { account: true },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "Usuário ou senha inválidos" },
        { status: 401 }
      );
    }

    if (!dbUser.password) {
      return NextResponse.json(
        { error: "Use o login com Google para esta conta" },
        { status: 400 }
      );
    }

    if (!dbUser.emailVerifiedAt) {
      return NextResponse.json(
        {
          error: "email_not_verified",
          message: "Verifique seu e-mail antes de entrar.",
          email: dbUser.email,
        },
        { status: 403 }
      );
    }

    const validPassword = await bcrypt.compare(password, dbUser.password);
    if (!validPassword) {
      return NextResponse.json(
        { error: "Usuário ou senha inválidos" },
        { status: 401 }
      );
    }

    const token = await new SignJWT({
      userId: dbUser.id,
      accountId: dbUser.accountId,
      email: dbUser.email,
      role: dbUser.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("6h")
      .sign(JWT_SECRET);

    return NextResponse.json({
      token,
      user: { id: dbUser.id, name: dbUser.name, email: dbUser.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erro ao processar login" },
      { status: 500 }
    );
  }
}
