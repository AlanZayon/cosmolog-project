import { useState, useEffect } from 'react';
import Link from "next/link";
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import { Plus, Globe } from 'lucide-react';
import { useRouter } from "next/navigation";

interface Universe {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  owner_id: string;
  created_at: string;
}

export default function UniversesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchUniverses();
  }, [user, router]);

  const fetchUniverses = async () => {
    setLoading(true);
    const { data } = await (supabase.from('universes') as any)
      .select('*')
      .eq('owner_id', user!.id)
      .order('created_at', { ascending: false });
    setUniverses(data || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-3xl animate-fade-in">
        <div className="mb-4">
          <Button variant="ghost" size="sm" className="-ml-2 h-9 px-2" asChild>
            <Link href="/">{t('common.back')}</Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold font-serif">{t('universes.title')}</h1>
          <Button asChild className="gradient-warm text-primary-foreground">
            <Link href="/universes/create"><Plus className="h-4 w-4 mr-1" /> {t('universes.new')}</Link>
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center">{t('common.loading')}</p>
        ) : universes.length === 0 ? (
          <div className="text-center py-16">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">{t('universes.empty')}</p>
            <Button asChild className="gradient-warm text-primary-foreground">
              <Link href="/universes/create">{t('universes.createFirst')}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {universes.map(u => (
              <Link
                key={u.id}
                href={`/universe/${u.id}`}
                className="group block rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 hover:shadow-warm transition-all duration-300"
              >
                <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                  {u.cover_image_url ? (
                    <img src={u.cover_image_url} alt={u.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full gradient-hero flex items-center justify-center">
                      <Globe className="h-10 w-10 text-primary-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground line-clamp-1">{u.title}</h3>
                  {u.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{u.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
