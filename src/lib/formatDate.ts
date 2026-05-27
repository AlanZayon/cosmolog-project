import type { Language } from '@/i18n/translations';

const COMMENT_LOCALES: Record<Language, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  ja: 'ja-JP',
  es: 'es-ES',
};

function parseTimeSerdeOffsetDateTime(value: unknown[]): Date | null {
  if (value.length < 3) return null;
  const [datePart, timePart, offsetSec] = value;
  if (!Array.isArray(datePart) || datePart.length < 2) return null;
  if (!Array.isArray(timePart) || timePart.length < 3) return null;
  const year = Number(datePart[0]);
  const ordinal = Number(datePart[1]);
  const hour = Number(timePart[0]);
  const minute = Number(timePart[1]);
  const second = Number(timePart[2]);
  const nanosecond = Number(timePart[3] ?? 0);
  const offset = Number(offsetSec ?? 0);
  if (![year, ordinal, hour, minute, second, nanosecond, offset].every(Number.isFinite)) {
    return null;
  }

  const utcMs =
    Date.UTC(year, 0, 1) +
    (ordinal - 1) * 86_400_000 +
    hour * 3_600_000 +
    minute * 60_000 +
    second * 1_000 +
    Math.floor(nanosecond / 1_000_000) -
    offset * 1_000;

  const d = new Date(utcMs);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseApiDate(value: unknown): Date | null {
  if (value == null) return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const direct = new Date(trimmed);
    if (!Number.isNaN(direct.getTime())) return direct;
    const normalized = trimmed
      .replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T')
      .replace(/(\.\d{3})\d+(?=[Z+-])/, '$1');
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (Array.isArray(value)) {
    return parseTimeSerdeOffsetDateTime(value);
  }

  return null;
}

/** Relative-ish short label for comment rows (Instagram-style). */
export function formatCommentRelative(value: unknown, language: Language): string {
  const date = parseApiDate(value);
  if (!date) return '';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return language === 'pt'
      ? 'agora'
      : language === 'ja'
        ? 'たった今'
        : language === 'es'
          ? 'ahora'
          : 'now';
  }
  if (minutes < 60) return `${minutes}${language === 'ja' ? '分' : language === 'pt' ? ' min' : 'm'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${language === 'ja' ? '時間' : language === 'pt' ? ' h' : 'h'}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}${language === 'ja' ? '日' : language === 'pt' ? ' d' : 'd'}`;

  try {
    return new Intl.DateTimeFormat(COMMENT_LOCALES[language], {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}

export function formatCommentDate(value: unknown, language: Language): string {
  const date = parseApiDate(value);
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(COMMENT_LOCALES[language], {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return '';
  }
}
