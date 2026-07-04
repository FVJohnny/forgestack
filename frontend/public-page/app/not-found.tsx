import Link from 'next/link';
import { Button } from '@/app/shared/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="space-y-4 text-center">
        <p className="font-mono text-sm text-ink-dim">404</p>
        <h2 className="text-xl font-semibold text-foreground">Page not found</h2>
        <p className="text-sm text-muted-foreground">
          The page you are looking for does not exist or has moved.
        </p>
        <Button asChild variant="primary">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
