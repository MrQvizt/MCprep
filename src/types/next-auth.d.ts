import type { DefaultSession } from "next-auth";

type Role = "OWNER" | "ADMIN" | "EDITOR";

declare module "next-auth" {
  interface User {
    role?: Role;
    sv?: number;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      sv: number;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    sv?: number;
  }
}
