import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { CalendarDays } from "lucide-react";
import type { WebinarDigestRow } from "@/lib/webinars/store";

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 text-[15px] leading-[1.5] text-[#201e1d] last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 text-[15px] leading-[1.5] last:mb-0">{children}</ul>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-2 text-[15px] font-semibold">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-1 text-[15px] font-semibold">{children}</h3>
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={href} className="underline underline-offset-2" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

export function DigestCard({ digest }: { digest: WebinarDigestRow | null }) {
  if (!digest) {
    return (
      <p className="flex items-center gap-2 rounded-[6px] border border-dashed border-[rgba(32,30,29,0.22)] bg-[#ffffff] px-4 py-3 text-[13px] text-[#605d5d]">
        <CalendarDays size={16} strokeWidth={2} />
        Friday digest publishes at 6:16pm.
      </p>
    );
  }
  return (
    <section className="rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff] px-6 py-5">
      <h2 className="mb-3 text-[18px] font-semibold text-[#201e1d]">This week across topics</h2>
      <ReactMarkdown components={markdownComponents}>{digest.body_md}</ReactMarkdown>
    </section>
  );
}
