import type { MDXComponents } from 'mdx/types';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Global MDX element styling for the /docs section. Maps the HTML that MDX emits
 * onto the Molten Forge design tokens so every doc page reads consistently with
 * the rest of the app. App-Router MDX picks this file up automatically.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props: ComponentPropsWithoutRef<'h1'>) => (
      <h1
        className="mt-2 scroll-mt-24 text-3xl font-semibold tracking-tight text-ink md:text-4xl"
        {...props}
      />
    ),
    h2: (props: ComponentPropsWithoutRef<'h2'>) => (
      <h2
        className="mt-12 scroll-mt-24 border-t border-line pt-8 text-2xl font-semibold tracking-tight text-ink"
        {...props}
      />
    ),
    h3: (props: ComponentPropsWithoutRef<'h3'>) => (
      <h3
        className="mt-8 scroll-mt-24 font-mono text-lg font-semibold tracking-tight text-ink"
        {...props}
      />
    ),
    h4: (props: ComponentPropsWithoutRef<'h4'>) => (
      <h4 className="mt-6 scroll-mt-24 font-mono text-sm font-semibold text-ink" {...props} />
    ),
    p: (props: ComponentPropsWithoutRef<'p'>) => (
      <p className="mt-4 text-[15px] leading-relaxed text-ink-dim" {...props} />
    ),
    ul: (props: ComponentPropsWithoutRef<'ul'>) => (
      <ul className="mt-4 list-disc space-y-2 pl-6 text-[15px] leading-relaxed text-ink-dim" {...props} />
    ),
    ol: (props: ComponentPropsWithoutRef<'ol'>) => (
      <ol
        className="mt-4 list-decimal space-y-2 pl-6 text-[15px] leading-relaxed text-ink-dim"
        {...props}
      />
    ),
    li: (props: ComponentPropsWithoutRef<'li'>) => <li className="pl-1 marker:text-ink-faint" {...props} />,
    strong: (props: ComponentPropsWithoutRef<'strong'>) => (
      <strong className="font-semibold text-ink" {...props} />
    ),
    a: ({ href = '', ...props }: ComponentPropsWithoutRef<'a'>) => {
      const external = href.startsWith('http');
      return (
        <a
          href={href}
          className="font-medium text-primary underline-offset-4 hover:underline"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          {...props}
        />
      );
    },
    blockquote: (props: ComponentPropsWithoutRef<'blockquote'>) => (
      <blockquote
        className="mt-4 border-l-2 border-primary/50 pl-4 text-[15px] italic text-ink-dim"
        {...props}
      />
    ),
    hr: () => <hr className="my-10 border-line" />,
    // Inline code (block code is handled by <pre>). Block code is detected by
    // the language- class or by rehype-pretty-code's data-language attribute
    // (it strips the class and highlights via inline-styled spans).
    code: ({ className, ...props }: ComponentPropsWithoutRef<'code'>) => {
      const isBlock = className?.includes('language-') || 'data-language' in props;
      if (isBlock) return <code className={className} {...props} />;
      return (
        <code
          className="rounded border border-line-strong bg-base-2 px-1.5 py-0.5 font-mono text-[0.85em] text-phosphor-soft"
          {...props}
        />
      );
    },
    pre: (props: ComponentPropsWithoutRef<'pre'>) => (
      <pre
        className="mt-5 overflow-x-auto rounded-lg border border-line-strong bg-base-2 p-4 font-mono text-[12.5px] leading-relaxed text-ink [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit"
        {...props}
      />
    ),
    table: (props: ComponentPropsWithoutRef<'table'>) => (
      <div className="mt-5 overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-left text-[13px]" {...props} />
      </div>
    ),
    thead: (props: ComponentPropsWithoutRef<'thead'>) => (
      <thead className="bg-base-2 text-ink" {...props} />
    ),
    th: (props: ComponentPropsWithoutRef<'th'>) => (
      <th
        className="border-b border-line px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint"
        {...props}
      />
    ),
    td: (props: ComponentPropsWithoutRef<'td'>) => (
      <td className="border-b border-line px-3 py-2 align-top text-ink-dim" {...props} />
    ),
    Callout,
    ...components,
  };
}

/** A highlighted note/warning/tip box for docs. */
function Callout({
  type = 'note',
  title,
  children,
}: {
  type?: 'note' | 'tip' | 'warning';
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    note: 'border-line-strong bg-base-2',
    tip: 'border-primary/30 bg-primary/[0.06]',
    warning: 'border-amber/30 bg-amber/[0.06]',
  }[type];
  const label = title ?? { note: 'Note', tip: 'Tip', warning: 'Heads up' }[type];
  const labelColor = { note: 'text-ink-faint', tip: 'text-primary', warning: 'text-amber' }[type];
  return (
    <div className={cn('mt-5 rounded-lg border p-4', styles)}>
      <p className={cn('font-mono text-[11px] font-semibold uppercase tracking-[0.12em]', labelColor)}>
        {label}
      </p>
      <div className="mt-1.5 [&>p]:mt-2 [&>p:first-child]:mt-0">{children}</div>
    </div>
  );
}
