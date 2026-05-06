import Link from "next/link";
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';
import { Globe2, Library } from 'lucide-react';
import type { FeedUniversePayload } from '@/lib/feed';

interface UniverseFeedCardProps {
  universe: FeedUniversePayload;
}

export default function UniverseFeedCard({ universe }: UniverseFeedCardProps) {
  const { t } = useLanguage();

  return (
    <Link href={`/universe/${universe.id}`} className="block">
      <article className="rounded-2xl border border-border bg-card overflow-hidden transition-transform hover:-translate-y-0.5">
        <div className="aspect-[16/8] overflow-hidden bg-muted border-b border-border">
          {universe.coverImageUrl ? (
            <img src={universe.coverImageUrl} alt={universe.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full gradient-hero flex items-center justify-center">
              <Globe2 className="h-10 w-10 text-primary-foreground/40" />
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline">{t('story.universe')}</Badge>
            <Badge variant="secondary">{universe.storyCount} hist.</Badge>
            <Badge variant="secondary">{(universe.arcCount ?? 0)} arcos</Badge>
          </div>

          <h2 className="text-2xl font-semibold font-serif leading-tight">{universe.title}</h2>
          {universe.tagline && <p className="mt-3 text-base leading-relaxed text-foreground/80">{universe.tagline}</p>}

          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Library className="h-4 w-4" /> {universe.storyCount} histórias e {(universe.arcCount ?? 0)} arcos
          </div>
        </div>
      </article>
    </Link>
  );
}
