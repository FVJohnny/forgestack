import { Suspense } from 'react';
import { AuthShell } from '@/app/shared/auth/auth-shell';
import { LoginForm } from './components/login-form';

function FormFallback() {
  return (
    <div className="flex justify-center py-16">
      <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<FormFallback />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
