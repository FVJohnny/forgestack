import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-white/[0.06] border border-line', className)}
      {...props}
    />
  );
}
