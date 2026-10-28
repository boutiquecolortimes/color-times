/**
 * Same rules as the server (lib/validations/auth.ts in the web app):
 * 8+ characters, an uppercase letter and a number. Returns the first
 * problem, or null when the password is acceptable.
 */
export function passwordIssues(password: string): string | null {
  if (password.length < 8) return 'At least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Add an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Add a number';
  return null;
}
