"use client";

import { useState } from "react";
import { LayoutTemplate, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailTemplatesClient } from "@/components/jasonos/email-templates/email-templates-client";
import { EmailBuilderClient } from "@/components/jasonos/email/email-builder-client";

type Section = "templates" | "builder";

const SECTIONS: {
  id: Section;
  label: string;
  icon: React.ReactNode;
  blurb: string;
}[] = [
  {
    id: "templates",
    label: "Templates",
    icon: <LayoutTemplate className="h-4 w-4" />,
    blurb:
      "Proven reconnection notes. Pick one, choose a contact, fill the blanks, open in Apple Mail.",
  },
  {
    id: "builder",
    label: "Email Builder",
    icon: <Wand2 className="h-4 w-4" />,
    blurb:
      "No template fits? Answer a few questions about the relationship and get a first draft in your voice.",
  },
];

export function EmailClient() {
  const [section, setSection] = useState<Section>("templates");
  const active = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 rounded-lg border bg-card p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            aria-pressed={section === s.id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              section === s.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{active.blurb}</p>

      {section === "templates" ? <EmailTemplatesClient /> : <EmailBuilderClient />}
    </div>
  );
}
