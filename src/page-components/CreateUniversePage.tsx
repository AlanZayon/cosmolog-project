import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { ApiError, createUniverse } from '@/lib/api';
import { uploadFile } from '@/lib/api/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Header from '@/components/Header';
import { useRouter } from "next/navigation";
import { useToast } from '@/hooks/use-toast';
import CharacterMeter from '@/components/CharacterMeter';
import { CONTENT_LIMITS, describeViolations, validateUniverseFields } from '@/lib/contentLimits';
import { ImagePlus, X } from 'lucide-react';

export default function CreateUniversePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t('story.imageTooLarge'), description: t('story.max5mb'), variant: 'destructive' });
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const removeCover = () => {
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const titleTrim = title.trim();
  const descTrim = description.trim();
  const universeViolations = validateUniverseFields(titleTrim, descTrim);
  const universeOverLimit = universeViolations.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !titleTrim) return;
    if (universeOverLimit) {
      toast({
        title: t('validation.charLimitsTitle'),
        description: describeViolations(t, universeViolations),
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      let cover_image_url: string | null = null;
      if (coverFile) {
        const ext = coverFile.name.split('.').pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        cover_image_url = await uploadFile('universe-covers', coverFile, path);
      }

      if (!user) {
        throw new Error('Not authenticated');
      }

      const data = await createUniverse({
        title: titleTrim,
        description: descTrim || null,
        cover_image_url,
      });

      toast({ title: t('createUniverse.success') });
      router.replace(`/universe/${data.id}`);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      toast({ title: t('common.error'), description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-lg animate-fade-in">
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="-ml-2 h-9 px-2" asChild>
            <Link href="/universes">{t('common.back')}</Link>
          </Button>
        </div>
        <h1 className="text-2xl font-bold font-serif mb-6">{t('createUniverse.title')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">{t('createUniverse.cover')}</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
            {coverPreview ? (
              <div className="relative w-full aspect-[16/9] max-w-sm rounded-lg overflow-hidden border border-border">
                <img src={coverPreview} alt="Preview" className="w-full h-full object-cover" />
                <button type="button" onClick={removeCover} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center w-full aspect-[16/9] max-w-sm rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/30">
                <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-xs text-muted-foreground">{t('createUniverse.addCover')}</span>
              </button>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{t('createUniverse.nameLabel')}</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('createUniverse.namePlaceholder')} required />
            <CharacterMeter length={title.length} max={CONTENT_LIMITS.universeTitle} className="mt-1 text-right" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{t('createUniverse.descLabel')}</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('createUniverse.descPlaceholder')} rows={4} />
            <CharacterMeter length={description.length} max={CONTENT_LIMITS.universeDescription} className="mt-1 text-right" />
          </div>
          <Button type="submit" className="w-full gradient-warm text-primary-foreground" disabled={loading || universeOverLimit || !titleTrim}>
            {loading ? t('common.creating') : t('createUniverse.submit')}
          </Button>
        </form>
      </main>
    </div>
  );
}
