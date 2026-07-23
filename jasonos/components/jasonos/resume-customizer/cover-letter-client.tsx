"use client";

// Cover Letter Customizer — generate a tailored cover letter from a resume
// that's already been customized for a job (reuses that job + resume context).
// Preview it, copy the text, or print/save as PDF in the letter format.

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Printer, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteCoverLetter,
  generateCoverLetterForCustomization,
  getCoverLetter,
  type CoverLetter,
  type CoverLetterRow,
} from "@/lib/server-actions/cover-letter";
import type { CustomizationRow } from "@/lib/server-actions/resume-customizer";

const LETTERHEAD = {
  name: "Jason Kuperman",
  location: "Greater New York City Area",
  phone: "862.400.1149",
  email: "jason.kuperman@outlook.com",
  linkedin: "www.linkedin.com/in/kuperman",
};

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function reLine(l: CoverLetter): string {
  return [l.role_title, l.company].filter(Boolean).join(" — ");
}

function plainText(l: CoverLetter): string {
  const lines: string[] = [];
  lines.push(LETTERHEAD.name);
  lines.push(
    `${LETTERHEAD.location} | ${LETTERHEAD.phone} | ${LETTERHEAD.email} | ${LETTERHEAD.linkedin}`
  );
  lines.push("");
  lines.push(today());
  lines.push("");
  if (reLine(l)) lines.push(`Re: ${reLine(l)}`);
  lines.push("");
  if (l.salutation) lines.push(l.salutation);
  lines.push("");
  if (l.opening) lines.push(l.opening);
  lines.push("");
  if (l.background) lines.push(l.background);
  lines.push("");
  if (l.highlights.length) {
    lines.push(
      "Select highlights of my career contributions and achievements thus far include:"
    );
    for (const h of l.highlights) lines.push(`\u2022 ${h}`);
    lines.push("");
  }
  if (l.closing) lines.push(l.closing);
  lines.push("");
  lines.push("Sincerely,");
  lines.push(LETTERHEAD.name);
  return lines.join("\n");
}

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function printLetter(l: CoverLetter) {
  const highlights = l.highlights.length
    ? `<p style="margin:9px 0 3px">Select highlights of my career contributions and achievements thus far include:</p>
       <ul style="margin:0 0 9px 0;padding-left:20px">${l.highlights
         .map((h) => `<li style="margin:1px 0">${esc(h)}</li>`)
         .join("")}</ul>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <title>${esc(LETTERHEAD.name)} — Cover Letter${reLine(l) ? ` — ${esc(reLine(l))}` : ""}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Georgia,'Times New Roman',serif;color:#111;background:#fff;margin:0;padding:40px;max-width:800px;font-size:12px;line-height:1.4}
      .head{text-align:center;border-bottom:1.5px solid #111;padding-bottom:7px;margin-bottom:13px}
      .name{font-size:22px;font-weight:700;letter-spacing:.5px}
      .contact{font-size:10.5px;color:#333;margin-top:3px}
      p{margin:0 0 9px}
      .meta{margin:0 0 4px}
      @media print{body{padding:14mm}}
    </style></head><body>
    <div class="head">
      <div class="name">${esc(LETTERHEAD.name)}</div>
      <div class="contact">${esc(LETTERHEAD.location)} | ${esc(LETTERHEAD.phone)} | ${esc(LETTERHEAD.email)} | ${esc(LETTERHEAD.linkedin)}</div>
    </div>
    <p class="meta">${esc(today())}</p>
    ${reLine(l) ? `<p class="meta"><strong>Re: ${esc(reLine(l))}</strong></p>` : ""}
    <p>${esc(l.salutation ?? "Dear Hiring Committee:")}</p>
    ${l.opening ? `<p>${esc(l.opening)}</p>` : ""}
    ${l.background ? `<p>${esc(l.background)}</p>` : ""}
    ${highlights}
    ${l.closing ? `<p>${esc(l.closing)}</p>` : ""}
    <p style="margin-top:12px;margin-bottom:0">Sincerely,</p>
    <p style="margin-top:2px">${esc(LETTERHEAD.name)}</p>
    <script>window.onload=function(){window.print();}</script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Pop-up blocked — allow pop-ups to print.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

export function CoverLetterClient({
  customizations,
  initialCoverLetters,
}: {
  customizations: CustomizationRow[];
  initialCoverLetters: CoverLetterRow[];
}) {
  const [custs, setCusts] = useState<CustomizationRow[]>(customizations);
  const [selectedId, setSelectedId] = useState(customizations[0]?.id ?? "");
  const [letters, setLetters] = useState<CoverLetterRow[]>(initialCoverLetters);
  const [active, setActive] = useState<CoverLetter | null>(null);
  const [generating, startGen] = useTransition();
  const [busy, startBusy] = useTransition();

  // When a resume is customized just above, auto-add it and select it so the
  // cover letter is written from the resume you just tailored.
  useEffect(() => {
    const onCustomized = (e: Event) => {
      const d = (e as CustomEvent).detail as CustomizationRow | undefined;
      if (!d?.id) return;
      setCusts((prev) => [d, ...prev.filter((c) => c.id !== d.id)]);
      setSelectedId(d.id);
    };
    window.addEventListener(
      "jasonos:resume-customized",
      onCustomized as EventListener
    );
    const onReset = () => setActive(null);
    window.addEventListener("jasonos:custom-comms-reset", onReset);
    return () => {
      window.removeEventListener(
        "jasonos:resume-customized",
        onCustomized as EventListener
      );
      window.removeEventListener("jasonos:custom-comms-reset", onReset);
    };
  }, []);

  const generate = () => {
    if (!selectedId) {
      toast.error("Pick a customized resume first.");
      return;
    }
    startGen(async () => {
      const res = await generateCoverLetterForCustomization(selectedId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setActive(res.coverLetter);
      setLetters((prev) => [
        {
          id: res.coverLetter.id,
          customization_id: res.coverLetter.customization_id,
          company: res.coverLetter.company,
          role_title: res.coverLetter.role_title,
          created_at: res.coverLetter.created_at,
        },
        ...prev,
      ]);
      toast.success("Cover letter drafted.");
    });
  };

  const load = (id: string) =>
    startBusy(async () => {
      const res = await getCoverLetter(id);
      if (res.ok) setActive(res.coverLetter);
      else toast.error(res.error);
    });

  const remove = (id: string) =>
    startBusy(async () => {
      const res = await deleteCoverLetter(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLetters((prev) => prev.filter((l) => l.id !== id));
      if (active?.id === id) setActive(null);
    });

  const copy = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(plainText(active));
      toast.success("Cover letter copied.");
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  };

  return (
    <section className="rounded-xl border bg-card/40 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background">
            2
          </span>
          <h2 className="text-sm font-semibold tracking-tight">
            Cover Letter Customizer
          </h2>
        </div>
        {active ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("jasonos:custom-comms-reset"))
            }
            title="Clear everything and start the next application"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Draft a cover letter from a resume you&rsquo;ve already tailored to a job.
        It reuses that job&rsquo;s description and your customized resume, so the
        letter is skewed to the opportunity and your background.
      </p>

      {custs.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
          Customize a resume for a job first (above). The cover letter is built
          from that tailored resume and its job description.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              From this customized resume
            </span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              {custs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company ?? "Company"} — {c.filename}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={generate} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Generate cover letter
          </Button>
        </div>
      )}

      {active ? (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-tight">
              {[active.role_title, active.company].filter(Boolean).join(" — ") ||
                "Cover letter"}
            </h3>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={copy}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={() => printLetter(active)}>
                <Printer className="h-3.5 w-3.5" /> Print / PDF
              </Button>
            </div>
          </div>
          <article className="space-y-3 rounded-lg border bg-background/50 p-4 text-sm leading-relaxed text-foreground/90">
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{LETTERHEAD.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {LETTERHEAD.location} | {LETTERHEAD.phone} | {LETTERHEAD.email} |{" "}
                {LETTERHEAD.linkedin}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{today()}</p>
            {reLine(active) ? (
              <p className="font-medium">Re: {reLine(active)}</p>
            ) : null}
            <p>{active.salutation}</p>
            {active.opening ? <p>{active.opening}</p> : null}
            {active.background ? <p>{active.background}</p> : null}
            {active.highlights.length ? (
              <div>
                <p>
                  Select highlights of my career contributions and achievements
                  thus far include:
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {active.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {active.closing ? <p>{active.closing}</p> : null}
            <p className="pt-2">Sincerely,</p>
            <p>{LETTERHEAD.name}</p>
          </article>
        </div>
      ) : null}

      {letters.length ? (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent cover letters
          </p>
          <ul className="divide-y divide-border/50 rounded-lg border">
            {letters.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
              >
                <button
                  type="button"
                  onClick={() => load(l.id)}
                  disabled={busy}
                  className="min-w-0 flex-1 text-left hover:underline"
                >
                  <span className="font-medium text-foreground">
                    {[l.role_title, l.company].filter(Boolean).join(" — ") ||
                      "Cover letter"}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString()}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(l.id)}
                  disabled={busy}
                  className="text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
