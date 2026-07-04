import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-line-strong bg-white/5 text-ink-dim',
        live: 'border-primary/30 bg-primary/10 text-primary',
        warn: 'border-[var(--amber)]/30 bg-[var(--amber)]/10 text-[var(--amber)]',
        down: 'border-[var(--red)]/30 bg-[var(--red)]/10 text-[var(--red)]',
        outline: 'border-line-strong bg-transparent text-ink-dim',
        accent: 'border-primary/40 bg-primary/15 text-primary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
