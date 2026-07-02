import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { DocsShell } from './components/docs-shell';

export const metadata: Metadata = {
  title: `Docs · ${BRAND.name}`,
  description: `Documentation for ${BRAND.name} — architecture, backend patterns, frontend, databases, monitoring and deployment.`,
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
