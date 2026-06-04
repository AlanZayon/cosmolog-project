/** Longest known username match after `@` (supports spaces in usernames). */
export function parseLeadingMention(
  content: string,
  knownUsernames: string[],
): { mention: string; rest: string } | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith('@')) return null;

  const afterAt = trimmed.slice(1);
  const sorted = [...knownUsernames]
    .filter((u) => u.trim().length > 0)
    .sort((a, b) => b.length - a.length);

  for (const username of sorted) {
    const lowerAfter = afterAt.toLowerCase();
    const lowerUser = username.toLowerCase();
    if (!lowerAfter.startsWith(lowerUser)) continue;

    const next = afterAt[username.length];
    if (next !== undefined && next !== ' ') continue;

    const rest = afterAt.slice(username.length).trimStart();
    return { mention: username, rest };
  }

  const fallback = trimmed.match(/^@(\S+)(?:\s+([\s\S]*))?$/);
  if (!fallback) return null;
  return {
    mention: fallback[1],
    rest: fallback[2]?.trim() ?? '',
  };
}
