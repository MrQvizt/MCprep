/**
 * Create (or reset the password of) an admin account.
 *
 *   npm run admin:create -- --email owner@example.com --name "Owner Name" --role OWNER
 *
 * The password is read from ADMIN_PASSWORD, or asked for interactively (hidden).
 * There are no default credentials.
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { db } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/passwords";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function promptHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, cb) {
      if (!muted) process.stdout.write(chunk, encoding as BufferEncoding);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  process.stdout.write(question);
  muted = true;
  const answer = await new Promise<string>((resolve) => rl.question("", resolve));
  muted = false;
  rl.close();
  process.stdout.write("\n");
  return answer;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim() || "Owner";
  const role = (arg("role")?.toUpperCase() ?? "OWNER") as "OWNER" | "ADMIN" | "EDITOR";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Usage: npm run admin:create -- --email you@example.com --name "Your Name" [--role OWNER|ADMIN|EDITOR]');
  }
  if (!["OWNER", "ADMIN", "EDITOR"].includes(role)) throw new Error("Role must be OWNER, ADMIN or EDITOR");

  const password = process.env.ADMIN_PASSWORD ?? (await promptHidden("Password (min 12 characters): "));
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);

  const passwordHash = await hashPassword(password);
  const existing = await db.adminUser.findUnique({ where: { email } });
  if (existing) {
    await db.adminUser.update({
      where: { email },
      data: { passwordHash, isActive: true, sessionVersion: { increment: 1 }, name, role },
    });
    console.log(`Updated admin ${email} (${role}). Existing sessions were signed out.`);
  } else {
    await db.adminUser.create({ data: { email, name, role, passwordHash } });
    console.log(`Created admin ${email} (${role}). Sign in at /admin/login`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
