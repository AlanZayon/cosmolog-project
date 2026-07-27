"use client";

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/useLanguage';

export type ReadingMode = 'vertical' | 'horizontal' | 'both';

interface ReadingModeFieldProps {
  value: ReadingMode;
  onChange: (value: ReadingMode) => void;
}

export default function ReadingModeField({ value, onChange }: ReadingModeFieldProps) {
  const { t } = useLanguage();

  return (
    <div>
      <label className="text-sm font-medium text-foreground mb-2 block">{t('story.readingMode')}</label>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as ReadingMode)}
        className="space-y-3"
      >
        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <RadioGroupItem value="vertical" id="reading-mode-vertical" className="mt-0.5" />
          <Label htmlFor="reading-mode-vertical" className="cursor-pointer font-normal leading-snug">
            <span className="font-medium text-foreground">{t('story.readingModeVertical')}</span>
            <p className="mt-1 text-xs text-muted-foreground">{t('story.readingModeVerticalDesc')}</p>
          </Label>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <RadioGroupItem value="horizontal" id="reading-mode-horizontal" className="mt-0.5" />
          <Label htmlFor="reading-mode-horizontal" className="cursor-pointer font-normal leading-snug">
            <span className="font-medium text-foreground">{t('story.readingModeHorizontal')}</span>
            <p className="mt-1 text-xs text-muted-foreground">{t('story.readingModeHorizontalDesc')}</p>
          </Label>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <RadioGroupItem value="both" id="reading-mode-both" className="mt-0.5" />
          <Label htmlFor="reading-mode-both" className="cursor-pointer font-normal leading-snug">
            <span className="font-medium text-foreground">{t('story.readingModeBoth')}</span>
            <p className="mt-1 text-xs text-muted-foreground">{t('story.readingModeBothDesc')}</p>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
