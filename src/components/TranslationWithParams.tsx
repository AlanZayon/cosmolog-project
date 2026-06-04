import {
  getTranslation,
  type Language,
  type TranslationKey,
} from '@/i18n/translations';
const PARAM_RE = /\{\{(\w+)\}\}/g;

function splitTranslationParts(
  template: string,
  params: Record<string, string>,
): Array<{ highlight: boolean; text: string }> {
  const parts: Array<{ highlight: boolean; text: string }> = [];
  let lastIndex = 0;

  for (const match of template.matchAll(PARAM_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ highlight: false, text: template.slice(lastIndex, index) });
    }
    const name = match[1];
    parts.push({ highlight: true, text: params[name] ?? '' });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < template.length) {
    parts.push({ highlight: false, text: template.slice(lastIndex) });
  }

  return parts;
}

type TranslationWithParamsProps = {
  translationKey: TranslationKey;
  language: Language;
  params: Record<string, string>;
  className?: string;
};

/** Renders a translation; values for `{{name}}` placeholders use the primary accent color. */
export default function TranslationWithParams({
  translationKey,
  language,
  params,
  className,
}: TranslationWithParamsProps) {
  const template = getTranslation(translationKey, language);
  const parts = splitTranslationParts(template, params);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.highlight ? (
          <span key={index} className="font-medium text-primary">
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  );
}

export function translationPreview(
  translationKey: TranslationKey,
  language: Language,
  params: Record<string, string>,
): string {
  const template = getTranslation(translationKey, language);
  return splitTranslationParts(template, params)
    .map((p) => p.text)
    .join('');
}
