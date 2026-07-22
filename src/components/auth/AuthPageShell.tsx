import CosmologLogo from '@/components/CosmologLogo';

type AuthPageShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  wide?: boolean;
};

export function AuthPageShell({ title, subtitle, children, wide = false }: AuthPageShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className={`animate-fade-in w-full ${wide ? 'max-w-md' : 'max-w-sm'}`}>
        <div className="mb-8 flex flex-col items-center text-center">
          <CosmologLogo size={48} className="mb-3" />
          <h1 className="font-serif text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-pretty text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
