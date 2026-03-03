import { SignJWT } from "jose";
import { NextResponse } from "next/server";

const MOCK_USER = {
  user: "admin",
  password: "fiscalflow123",
};

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

    if (user !== MOCK_USER.user || password !== MOCK_USER.password) {
      return NextResponse.json(
        { error: "Usuário ou senha inválidos" },
        { status: 401 }
      );
    }

    const token = await new SignJWT({ user, role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("6h")
      .sign(JWT_SECRET);

    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao processar login" },
      { status: 500 }
    );
  }
}
