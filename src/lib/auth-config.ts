import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fiscal-flow-secret-key-dev"
);

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL ?? "")
  .trim()
  .toLowerCase();

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return false;

      const email = user.email.toLowerCase();
      const isSuperadmin = SUPERADMIN_EMAIL && email === SUPERADMIN_EMAIL;

      const existingUser = await prisma.user.findFirst({
        where: { email },
        include: { account: true },
      });

      if (!existingUser) {
        const newAccount = await prisma.account.create({
          data: {
            name: user.name ?? user.email.split("@")[0],
            plan: "free",
          },
        });
        await prisma.user.create({
          data: {
            email,
            name: user.name ?? user.email.split("@")[0],
            image: user.image ?? null,
            password: null,
            role: isSuperadmin ? "superadmin" : "admin",
            accountId: newAccount.id,
            emailVerifiedAt: new Date(),
          },
        });
      } else if (isSuperadmin && existingUser.role !== "superadmin") {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: "superadmin" },
        });
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        const dbUser = await prisma.user.findFirst({
          where: { email: user.email.toLowerCase() },
          include: { account: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.accountId = dbUser.accountId;
          token.role = dbUser.role;
          token.plan = dbUser.account?.plan ?? "free";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session as { userId?: string; accountId?: string; role?: string; plan?: string }).userId = token.userId as string;
        (session as { userId?: string; accountId?: string; role?: string; plan?: string }).accountId = token.accountId as string;
        (session as { userId?: string; accountId?: string; role?: string; plan?: string }).role = token.role as string;
        let plan = (token.plan as string) ?? "free";
        if (token.accountId) {
          const account = await prisma.account.findUnique({
            where: { id: token.accountId as string },
            select: { plan: true },
          });
          if (account) plan = account.plan;
        }
        (session as { userId?: string; accountId?: string; role?: string; plan?: string }).plan = plan;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.JWT_SECRET,
};

export async function createTokenFromSession(session: { userId: string; accountId: string; email?: string; role: string }) {
  return new SignJWT({
    userId: session.userId,
    accountId: session.accountId,
    email: session.email,
    role: session.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("6h")
    .sign(JWT_SECRET);
}
