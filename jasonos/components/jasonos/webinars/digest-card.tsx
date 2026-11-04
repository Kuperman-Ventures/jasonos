import ReactMarkdown from "react-markdown";
import type { WebinarDigestRow } from "@/lib/webinars/store";

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 text-sm last:mb-0">{children}</ul>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-2 text-sm font-semibold">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 text-sm font-semibold">{children}</h3>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} className="underline underline-offset-2" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

export function DigestCard({ digest }: { digest: WebinarDigestRow | null }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {digest ? (
        <ReactMarkdown components={markdownComponents}>{digest.body_md}</ReactMarkdown>
      ) : (
        <p className="text-sm text-muted-foreground">Digest publishes Friday evening.</p>
      )}
    </div>
  );
}
