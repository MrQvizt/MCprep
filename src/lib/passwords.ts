import bcrypt from "bcryptjs";

export const PASSWORD_MIN_LENGTH = 12;
/** Customer portal accounts: a little shorter to keep sign-up easy. */
export const CUSTOMER_PASSWORD_MIN_LENGTH = 10;
const COST = 12;

// Used to keep login timing similar when the email does not exist.
const DUMMY_HASH = "$2b$12$fNb0DmbBelCujo/Wx9FGdO.8H2HOyPI5lrYeJ53PHxsJTYKCCc3B2";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password: string, minLength = PASSWORD_MIN_LENGTH): string | null {
  if (password.length < minLength) return `Use at least ${minLength} characters.`;
  if (password.length > 200) return "Password is too long.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9\W_]/.test(password)) return "Mix letters with numbers or symbols.";
  return null;
}
