import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from '@/hooks/use-toast';
import CosmologLogo from '@/components/CosmologLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const redirectPath = (() => {
    const target = searchParams.get('redirect');
    if (target?.startsWith('/') && !target.startsWith('//')) {
      return target;
    }
    return '/';
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      router.push(redirectPath);
    } catch (err: any) {
      toast({ title: t('login.error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8 flex flex-col items-center">
          <CosmologLogo size={48} className="mb-3" />
          <h1 className="text-2xl font-bold font-serif">{t('login.welcome')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('login.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="email" placeholder={t('login.email')} value={email} onChange={e => setEmail(e.target.value)} required />
          <Input type="password" placeholder={t('login.password')} value={password} onChange={e => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full gradient-warm text-primary-foreground" disabled={loading}>
            {loading ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-4">
          {t('login.noAccount')} <Link href="/signup" className="text-primary font-medium hover:underline">{t('login.signupLink')}</Link>
        </p>
      </div>
    </div>
  );
}
