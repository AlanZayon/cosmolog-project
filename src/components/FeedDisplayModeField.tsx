"use client";

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/useLanguage';

export type FeedDisplayMode = 'preview' | 'cover';

interface FeedDisplayModeFieldProps {
  value: FeedDisplayMode;
  onChange: (value: FeedDisplayMode) => void;
}

export default function FeedDisplayModeField({ value, onChange }: FeedDisplayModeFieldProps) {
  const { t } = useLanguage();

  return (
    <div>
      <label className="text-sm font-medium text-foreground mb-2 block">{t('story.feedDisplay')}</label>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as FeedDisplayMode)}
        className="space-y-3"
      >
        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <RadioGroupItem value="preview" id="feed-display-preview" className="mt-0.5" />
          <Label htmlFor="feed-display-preview" className="cursor-pointer font-normal leading-snug">
            <span className="font-medium text-foreground">{t('story.feedDisplayPreview')}</span>
            <p className="mt-1 text-xs text-muted-foreground">{t('story.feedDisplayPreviewDesc')}</p>
          </Label>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <RadioGroupItem value="cover" id="feed-display-cover" className="mt-0.5" />
          <Label htmlFor="feed-display-cover" className="cursor-pointer font-normal leading-snug">
            <span className="font-medium text-foreground">{t('story.feedDisplayCover')}</span>
            <p className="mt-1 text-xs text-muted-foreground">{t('story.feedDisplayCoverDesc')}</p>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
