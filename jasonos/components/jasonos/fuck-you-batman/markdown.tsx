import type { ReactNode } from "react";

export const fybMarkdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mt-2 text-sm leading-relaxed text-foreground/80">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground/80">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-foreground/80">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-3 text-sm font-semibold">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-3 text-sm font-semibold">{children}</h3>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
};
