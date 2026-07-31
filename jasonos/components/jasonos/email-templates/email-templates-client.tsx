"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Mail,
  Search,
  AlertTriangle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EMAIL_TEMPLATES,
  type EmailTemplate,
} from "@/lib/email-templates/templates";
import {
  buildMailtoUrl,
  firstNameFromFullName,
  missingRequiredFields,
  renderTemplate,
} from "@/lib/email-templates/render";
import {
  deleteCustomEmailTemplate,
  getCustomEmailTemplates,
  searchContactsForEmailTemplate,
  type EmailTemplateContactHit,
} from "@/lib/server-actions/email-templates";

type Step = "pick" | "recipient" | "fill" | "preview";

export function EmailTemplatesClient() {
  const [step, setStep] = useState<Step>("pick");
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [recipient, setRecipient] = useState<EmailTemplateContactHit | null>(
    null
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<EmailTemplate[]>([]);

  useEffect(() => {
    let cancelled = false;
    getCustomEmailTemplates().then((rows) => {
      if (!cancelled) setCustom(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const removeCustom = async (id: string) => {
    const prev = custom;
    setCustom((c) => c.filter((t) => t.id !== id));
    const res = await deleteCustomEmailTemplate(id);
    if (!res.ok) {
      setCustom(prev);
      toast.error(res.error);
    } else {
      toast.success("Template deleted.");
    }
  };

  const subject = useMemo(
    () => (template ? renderTemplate(template.subjectTemplate, values) : ""),
    [template, values]
  );
  const body = useMemo(
    () => (template ? renderTemplate(template.bodyTemplate, values) : ""),
    [template, values]
  );

  const selectTemplate = (t: EmailTemplate) => {
    setTemplate(t);
    setRecipient(null);
    setValues({});
    setStep("recipient");
  };

  const selectRecipient = (c: EmailTemplateContactHit) => {
    if (!template) return;
    if (!c.email) {
      toast.error("That contact has no email on file. Add one on their card first.");
      return;
    }
    setRecipient(c);
    const next: Record<string, string> = {};
    for (const f of template.fields) {
      if (f.fromContactFirstName) {
        next[f.key] = firstNameFromFullName(c.name);
      } else {
        next[f.key] = "";
      }
    }
    setValues(next);
    setStep("fill");
  };

  const goPreview = () => {
    if (!template) return;
    const missing = missingRequiredFields(template, values);
    if (missing.length) {
      toast.error(`Still need: ${missing.join(", ")}`);
      return;
    }
    setStep("preview");
  };

  const openInMail = () => {
    if (!recipient?.email || !template) return;
    const missing = missingRequiredFields(template, values);
    if (missing.length) {
      toast.error(`Still need: ${missing.join(", ")}`);
      return;
    }
    const href = buildMailtoUrl({
      to: recipient.email,
      subject,
      body,
    });
    // Prefer navigation so Apple Mail (default mailto handler on Mac) opens
    // with To / Subject / Body prefilled. User edits and sends from there;
    // Gmail sync picks up the sent message afterward.
    window.location.href = href;
    toast.success("Opening Mail… finish the send there.");
  };

  const copyDraft = async () => {
    const text = `To: ${recipient?.email ?? ""}\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Draft copied - paste into Mail if needed.");
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  };

  const reset = () => {
    setStep("pick");
    setTemplate(null);
    setRecipient(null);
    setValues({});
  };

  return (
    <div className="space-y-6">
      <StepRail step={step} />

      {step === "pick" ? (
        <TemplatePicker
          custom={custom}
          onSelect={selectTemplate}
          onDeleteCustom={removeCustom}
        />
      ) : null}

      {step === "recipient" && template ? (
        <RecipientStep
          template={template}
          onBack={reset}
          onSelect={selectRecipient}
        />
      ) : null}

      {step === "fill" && template && recipient ? (
        <FillStep
          template={template}
          recipient={recipient}
          values={values}
          onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
          onBack={() => setStep("recipient")}
          onNext={goPreview}
        />
      ) : null}

      {step === "preview" && template && recipient ? (
        <PreviewStep
          template={template}
          recipient={recipient}
          subject={subject}
          body={body}
          onBack={() => setStep("fill")}
          onOpenMail={openInMail}
          onCopy={copyDraft}
          onStartOver={reset}
        />
      ) : null}
    </div>
  );
}

function StepRail({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "pick", label: "Template" },
    { id: "recipient", label: "Contact" },
    { id: "fill", label: "Personalize" },
    { id: "preview", label: "Open in Mail" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[11px]">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-medium tabular-nums",
              i < idx
                ? "bg-emerald-500/20 text-emerald-300"
                : i === idx
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {i < idx ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <span
            className={cn(
              i === idx ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 ? (
            <span className="text-muted-foreground/50">→</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function TemplatePicker({
  custom,
  onSelect,
  onDeleteCustom,
}: {
  custom: EmailTemplate[];
  onSelect: (t: EmailTemplate) => void;
  onDeleteCustom: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      {custom.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-orange-300" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
              Your saved templates
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {custom.map((t) => (
              <div
                key={t.id}
                className="group relative rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30 hover:bg-muted/30"
              >
                <button
                  type="button"
                  onClick={() => onSelect(t)}
                  className="block w-full text-left"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-300">
                    Custom
                  </span>
                  <h3 className="mt-1 pr-7 text-sm font-semibold tracking-tight">
                    {t.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t.blurb}</p>
                  {t.subjectTemplate ? (
                    <p className="mt-3 truncate text-[11px] text-muted-foreground">
                      Subject:{" "}
                      <span className="text-foreground/80">
                        {t.subjectTemplate}
                      </span>
                    </p>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCustom(t.id)}
                  aria-label="Delete template"
                  title="Delete template"
                  className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-rose-300 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {EMAIL_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className="rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/30 hover:bg-muted/30"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-300">
                Option {String(t.optionNumber).padStart(2, "0")}
              </span>
              {t.fields.length > 1 ? (
                <span className="text-[10px] text-muted-foreground">
                  {t.fields.length - 1} custom field
                  {t.fields.length - 1 === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-sm font-semibold tracking-tight">
              {t.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{t.blurb}</p>
            <p className="mt-3 truncate text-[11px] text-muted-foreground">
              Subject:{" "}
              <span className="text-foreground/80">{t.subjectTemplate}</span>
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function RecipientStep({
  template,
  onBack,
  onSelect,
}: {
  template: EmailTemplate;
  onBack: () => void;
  onSelect: (c: EmailTemplateContactHit) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmailTemplateContactHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      setSearching(true);
      searchContactsForEmailTemplate(query, 24)
        .then((r) => {
          if (!cancelled) setResults(r);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            All templates
          </button>
          <h2 className="text-sm font-semibold tracking-tight">
            Who are you writing to?
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Using{" "}
            <span className="text-foreground">
              Option {String(template.optionNumber).padStart(2, "0")} ·{" "}
              {template.title}
            </span>
            . Pick someone from your contact list - their email will be the
            recipient in Mail.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 pl-8 text-sm"
          placeholder="Search contacts by name…"
          autoFocus
        />
      </div>

      <div className="max-h-80 overflow-y-auto rounded-md border bg-background/40">
        {searching && results.length === 0 ? (
          <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </div>
        ) : results.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No matches. Add the person with Add contact in the top nav, then
            come back.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {r.name}
                      {r.firm ? (
                        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                          · {r.firm}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.email ?? "No email on file"}
                      {r.title ? ` · ${r.title}` : ""}
                    </p>
                  </div>
                  {!r.email ? (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-amber-300">
                      Needs email
                    </span>
                  ) : (
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function FillStep({
  template,
  recipient,
  values,
  onChange,
  onBack,
  onNext,
}: {
  template: EmailTemplate;
  recipient: EmailTemplateContactHit;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Change contact
        </button>
        <h2 className="text-sm font-semibold tracking-tight">
          Fill in the blanks
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          To{" "}
          <span className="text-foreground">
            {recipient.name}
            {recipient.email ? ` · ${recipient.email}` : ""}
          </span>
        </p>
      </div>

      {template.warning ? (
        <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{template.warning}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {template.fields.map((f) => (
          <label key={f.key} className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {f.label}
              {f.required ? " *" : ""}
            </span>
            {f.key === "memory" || f.key === "reason" || f.key === "sharedContext" ? (
              <Textarea
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="min-h-[72px] text-sm"
              />
            ) : (
              <Input
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="h-9 text-sm"
              />
            )}
            {f.hint ? (
              <span className="block text-[11px] text-muted-foreground">
                {f.hint}
              </span>
            ) : null}
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" onClick={onNext}>
          Preview draft
        </Button>
      </div>
    </section>
  );
}

function PreviewStep({
  template,
  recipient,
  subject,
  body,
  onBack,
  onOpenMail,
  onCopy,
  onStartOver,
}: {
  template: EmailTemplate;
  recipient: EmailTemplateContactHit;
  subject: string;
  body: string;
  onBack: () => void;
  onOpenMail: () => void;
  onCopy: () => void;
  onStartOver: () => void;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Edit fields
          </button>
          <h2 className="text-sm font-semibold tracking-tight">
            Ready for Apple Mail
          </h2>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
            Option {String(template.optionNumber).padStart(2, "0")} ·{" "}
            {template.title}. Opens your Mac&rsquo;s Mail app with To, subject,
            and body filled in. Do the final edit and send there - once it hits
            your synced inbox, JasonOS will pick it up and update the queue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCopy}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy draft
          </Button>
          <Button type="button" size="sm" onClick={onOpenMail}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Open in Apple Mail
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-background/50 p-4">
        <MetaRow label="To" value={recipient.email ?? "-"} />
        <MetaRow label="Subject" value={subject} />
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Body
          </p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
            {body}
          </pre>
        </div>
      </div>

      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onStartOver}>
          Start over
        </Button>
        <Button type="button" onClick={onOpenMail}>
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Open in Apple Mail
        </Button>
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
