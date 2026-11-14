import { ProjectLinks } from "@/components/jasonos/project-links";

export const metadata = {
  title: "LOTR",
  description: "Standalone LOTR project surface outside JasonOS login and chrome.",
};

export default function LotrPage() {
  return (
    <div className="mx-auto max-w-[720px] space-y-4 px-4 py-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Personal project
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">LOTR</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Standalone surface. No JasonOS login or top nav. Content lands next.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-4">
        <p className="text-sm leading-relaxed text-foreground/80">
          This is the empty shell for LOTR. It lives under Projects, opens without
          the JasonOS lock, and hides the OS chrome the same way Oversight does.
        </p>
      </section>

      <ProjectLinks slug="lotr" />
    </div>
  );
}
