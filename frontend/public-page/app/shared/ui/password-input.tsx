'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/app/shared/ui/input';
import { cn } from '@/lib/utils';

export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint transition-colors hover:text-primary"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
