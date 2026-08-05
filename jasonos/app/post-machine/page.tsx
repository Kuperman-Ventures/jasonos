import type { Metadata } from "next";
import { Share2 } from "lucide-react";

export const metadata: Metadata = { title: "Post Machine · JasonOS" };

export default function PostMachinePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-300">
          <Share2 className="h-4 w-4" />
          Custom Comms
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Post Machine
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Placeholder for Post Machine. Functionality coming next.
        </p>
      </header>

      <section className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Nothing here yet — this page is ready for the first build.
        </p>
      </section>
    </div>
  );
}
