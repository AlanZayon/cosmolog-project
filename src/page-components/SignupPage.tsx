import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from '@/hooks/use-toast';
import CosmologLogo from '@/components/CosmologLogo';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(email, password, username);
      toast({ title: t('signup.success'), description: t('signup.confirmEmail') });
      router.push("/");
    } catch (err: any) {
      toast({ title: t('signup.error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8 flex flex-col items-center">
          <CosmologLogo size={48} className="mb-3" />
          <h1 className="text-2xl font-bold font-serif">{t('signup.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('signup.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder={t('signup.username')} value={username} onChange={e => setUsername(e.target.value)} required />
          <Input type="email" placeholder={t('login.email')} value={email} onChange={e => setEmail(e.target.value)} required />
          <Input type="password" placeholder={t('signup.password')} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          <Button type="submit" className="w-full gradient-warm text-primary-foreground" disabled={loading}>
            {loading ? t('signup.submitting') : t('signup.submit')}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-4">
          {t('signup.hasAccount')} <Link href="/login" className="text-primary font-medium hover:underline">{t('signup.loginLink')}</Link>
        </p>
      </div>
    </div>
  );
}
