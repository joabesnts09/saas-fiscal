import { jwtVerify } from "jose";
import { getServerSession } from "next-auth";
import { prisma } from "./db";
import { authOptions } from "./auth-config";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fiscal-flow-secret-key-dev"
);

export type AuthResult = {
  accountId: string;
  userId: string;
  role?: string;
  plan?: string;
} | null;

async function enrichWithPlan(auth: { accountId: string; userId: string; role?: string }): Promise<AuthResult> {
  const account = await prisma.account.findUnique({
    where: { id: auth.accountId },
    select: { plan: true },
  });
  return { ...auth, plan: account?.plan ?? "free" };
}

export async function getAuthFromRequest(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") ?? request.headers.get("x-token");

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const accountId = payload.accountId as string;
      const userId = payload.userId as string;
      const role = payload.role as string | undefined;
      if (accountId && userId) return enrichWithPlan({ accountId, userId, role });
    } catch {
      /* token inválido, tenta session */
    }
  }

  const session = await getServerSession(authOptions);
  const s = session as { userId?: string; accountId?: string; role?: string; plan?: string } | null;
  if (s?.accountId && s?.userId) {
    return { accountId: s.accountId, userId: s.userId, role: s.role, plan: s.plan ?? "free" };
  }

  return null;
}
