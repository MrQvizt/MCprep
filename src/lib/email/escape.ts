export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape and keep line breaks. */
export function escapeMultiline(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

/** Strip CR/LF to prevent header injection in subjects. */
export function safeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").slice(0, 200);
}
