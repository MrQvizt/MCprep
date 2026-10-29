import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/request";

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  providers: [
    Credentials({
      credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ip = request instanceof Request ? clientIpFrom(request.headers) : "unknown";
        const [byIp, byEmail] = await Promise.all([
          rateLimit(`login-ip:${ip}`, 20, 15 * 60),
          rateLimit(`login-email:${email}`, 8, 15 * 60),
        ]);
        if (!byIp.ok || !byEmail.ok) throw new RateLimitedSignin();

        const user = await db.adminUser.findUnique({ where: { email } });
        const valid = await verifyPassword(password, user?.passwordHash);
        if (!user || !valid || !user.isActive) return null;

        await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.name, role: user.role, sv: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.sv = user.sv;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid ?? "";
      session.user.role = token.role ?? "EDITOR";
      session.user.sv = token.sv ?? 0;
      return session;
    },
  },
});
