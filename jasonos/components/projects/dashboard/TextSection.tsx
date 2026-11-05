import type { Section } from "@/lib/dashboard/schema";
import { SectionHeading } from "./section-heading";

type Text = Extract<Section, { type: "text" }>;

export function TextSection({ section }: { section: Text }) {
  return (
    <section id={section.id} className="scroll-mt-6">
      {section.heading ? <SectionHeading>{section.heading}</SectionHeading> : null}
      <div className="space-y-3">
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph} className="max-w-3xl text-sm leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
