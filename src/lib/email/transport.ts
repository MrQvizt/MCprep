import "server-only";
import { Resend } from "resend";
import { emailTransport, env } from "@/lib/env";

export interface OutgoingEmail {
  id: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
}

export interface DeliveryResult {
  provider: string;
  messageId: string | null;
}

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    readonly permanent = false,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export type EmailTransport = (email: OutgoingEmail) => Promise<DeliveryResult>;

export function defaultFromAddress(): string {
  return env().EMAIL_FROM || "MC PREPS <onboarding@resend.dev>";
}

let resendClient: Resend | null = null;

const resendTransport: EmailTransport = async (email) => {
  const key = env().RESEND_API_KEY;
  if (!key) throw new EmailDeliveryError("RESEND_API_KEY is not configured");
  resendClient ??= new Resend(key);
  const { data, error } = await resendClient.emails.send(
    {
      from: defaultFromAddress(),
      to: email.to,
      replyTo: email.replyTo || undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
    },
    // Same outbox id → provider de-duplicates retries (no double emails).
    { idempotencyKey: `outbox-${email.id}` },
  );
  if (error) {
    const permanent = /validation|invalid|not_found|restricted/i.test(`${error.name ?? ""}`);
    throw new EmailDeliveryError(`${error.name ?? "error"}: ${error.message}`, permanent);
  }
  return { provider: "resend", messageId: data?.id ?? null };
};

const consoleTransport: EmailTransport = async (email) => {
  console.info(
    `\n[email:console] To: ${email.to}\n[email:console] Subject: ${email.subject}\n${email.text.slice(0, 1200)}\n`,
  );
  return { provider: "console", messageId: `console-${email.id}` };
};

/** The configured transport, or null when email sending is disabled. */
export function getTransport(): EmailTransport | null {
  const t = emailTransport();
  if (t === "resend") return resendTransport;
  if (t === "console") return consoleTransport;
  return null;
}
