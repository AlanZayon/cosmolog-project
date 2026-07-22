/** OWASP-aligned password checks for signup. */
export type PasswordChecks = {
  length: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
  special: boolean;
};

export type PasswordStrength = {
  checks: PasswordChecks;
  score: number;
  isStrong: boolean;
  label: 'weak' | 'fair' | 'strong';
};

export function evaluatePassword(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    length: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  const isStrong = score === 5;

  let label: PasswordStrength['label'] = 'weak';
  if (score >= 4) label = 'fair';
  if (isStrong) label = 'strong';

  return { checks, score, isStrong, label };
}
