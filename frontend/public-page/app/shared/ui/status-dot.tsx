import { cn } from '@/lib/utils';

export type StatusKind = 'live' | 'warn' | 'down' | 'idle';

const dotClass: Record<StatusKind, string> = {
  live: 'dot-live',
  warn: 'dot-warn',
  down: 'dot-down',
  idle: 'dot-idle',
};

export function StatusDot({ status, className }: { status: StatusKind; className?: string }) {
  return <span className={cn('dot', dotClass[status], className)} aria-hidden="true" />;
}
