const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Latest birth date that still makes the user at least 18 years old. */
export function maxBirthDateForMinAge(minAge = 18): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - minAge);
  return date.toISOString().slice(0, 10);
}

export function isAtLeastAge(birthDate: string, minAge = 18): boolean {
  const parsed = Date.parse(`${birthDate}T00:00:00`);
  if (Number.isNaN(parsed)) return false;
  const ageMs = Date.now() - parsed;
  return ageMs >= minAge * MS_PER_YEAR;
}
