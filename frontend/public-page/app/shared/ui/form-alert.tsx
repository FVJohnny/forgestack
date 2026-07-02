import { cn } from '@/lib/utils';

export function FormAlert({
  kind,
  children,
  className,
}: {
  kind: 'error' | 'success' | 'info';
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    error: 'border-[var(--red)]/30 bg-[var(--red)]/10 text-[var(--red)]',
    success: 'border-primary/30 bg-primary/10 text-primary',
    info: 'border-[var(--amber)]/30 bg-[var(--amber)]/10 text-[var(--amber)]',
  }[kind];

  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-md border px-3.5 py-2.5 font-mono text-[13px] leading-relaxed',
        styles,
        className,
      )}
    >
      {children}
    </div>
  );
}
