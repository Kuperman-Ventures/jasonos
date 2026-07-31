"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Copy,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { ContactPicker } from "@/components/jasonos/email/contact-picker";
import {
  saveCustomEmailTemplate,
  type EmailTemplateContactHit,
} from "@/lib/server-actions/email-templates";
import { buildMailtoUrl } from "@/lib/email-templates/render";
import {
  DEFAULT_ANSWERS,
  GOAL_OPTIONS,
  LAST_SPOKE_OPTIONS,
  LENGTH_OPTIONS,
  CLOSENESS_ENDS,
  REMEMBER_ENDS,
  TONE_ENDS,
  SLIDER_MIN,
  SLIDER_MAX,
  type BuilderAnswers,
  type Length,
} from "@/lib/email-builder/model";
import {
  generateBuilderEmail,
  type BuilderDraft,
  type BuilderRecipient,
} from "@/lib/server-actions/email-builder";

type Step = "recipient" | "questions" | "preview";

export function EmailBuilderClient() {
  const [step, setStep] = useState<Step>("recipient");
  const [recipient, setRecipient] = useState<EmailTemplateContactHit | null>(
    null
  );
  const [answers, setAnswers] = useState<BuilderAnswers>(DEFAULT_ANSWERS);
  const [draft, setDraft] = useState<BuilderDraft | null>(null);
  const [pending, startTransition] = useTransition();
  // "remember" and "tone" follow the closeness slider until the user drags
  // them directly. Distant contact → warmer tone + more reintroduction; close
  // contact → they remember you, can be more direct.
  const [linked, setLinked] = useState({ remember: true, tone: true });

  const set = <K extends keyof BuilderAnswers>(
    key: K,
    value: BuilderAnswers[K]
  ) => setAnswers((prev) => ({ ...prev, [key]: value }));

  const setCloseness = (n: number) =>
    setAnswers((prev) => ({
      ...prev,
      closeness: n,
      remember: linked.remember ? n : prev.remember,
      tone: linked.tone ? n : prev.tone,
    }));

  const setRemember = (n: number) => {
    setLinked((l) => ({ ...l, remember: false }));
    set("remember", n);
  };

  const setTone = (n: number) => {
    setLinked((l) => ({ ...l, tone: false }));
    set("tone", n);
  };

  const toggleGoal = (key: string) =>
    setAnswers((prev) => ({
      ...prev,
      goals: prev.goals.includes(key)
        ? prev.goals.filter((g) => g !== key)
        : [...prev.goals, key],
    }));

  const selectRecipient = (c: EmailTemplateContactHit) => {
    if (!c.email) {
      toast.error(
        "That contact has no email on file. Add one on their card first."
      );
      return;
    }
    setRecipient(c);
    setStep("questions");
  };

  const asRecipient = (c: EmailTemplateContactHit): BuilderRecipient => ({
    name: c.name,
    firm: c.firm,
    title: c.title,
    email: c.email,
  });

  const generate = () => {
    if (!recipient) return;
    startTransition(async () => {
      const res = await generateBuilderEmail({
        recipient: asRecipient(recipient),
        answers,
      });
      setDraft(res.draft);
      setStep("preview");
      if (!res.ok) {
        toast.warning(res.error);
      } else if (res.source === "fallback") {
        toast.info("Drafting model unavailable - starter draft ready to edit.");
      } else {
        toast.success("Draft ready. Edit and send from Mail.");
      }
    });
  };

  const openInMail = () => {
    if (!recipient?.email || !draft) return;
    const href = buildMailtoUrl({
      to: recipient.email,
      subject: draft.subject,
      body: draft.body,
    });
    window.location.href = href;
    toast.success("Opening Mail… finish the send there.");
  };

  const copyDraft = async () => {
    if (!draft) return;
    const text = `To: ${recipient?.email ?? ""}\nSubject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Draft copied.");
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  };

  const reset = () => {
    setStep("recipient");
    setRecipient(null);
    setAnswers(DEFAULT_ANSWERS);
    setDraft(null);
    setLinked({ remember: true, tone: true });
  };

  return (
    <div className="space-y-6">
      <StepRail step={step} />

      {step === "recipient" ? (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Who is this email to?
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pick someone from your contact list. Their email becomes the
              recipient in Mail. The builder helps when a template won&rsquo;t
              fit.
            </p>
          </div>
          <ContactPicker onSelect={selectRecipient} />
        </section>
      ) : null}

      {step === "questions" && recipient ? (
        <QuestionsStep
          recipient={recipient}
          answers={answers}
          set={set}
          setCloseness={setCloseness}
          setRemember={setRemember}
          setTone={setTone}
          toggleGoal={toggleGoal}
          onBack={reset}
          onGenerate={generate}
          pending={pending}
        />
      ) : null}

      {step === "preview" && recipient && draft ? (
        <PreviewStep
          recipient={recipient}
          draft={draft}
          onChange={setDraft}
          onBack={() => setStep("questions")}
          onRegenerate={generate}
          onOpenMail={openInMail}
          onCopy={copyDraft}
          onStartOver={reset}
          pending={pending}
        />
      ) : null}
    </div>
  );
}

function StepRail({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "recipient", label: "Contact" },
    { id: "questions", label: "Answer a few questions" },
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
          <span className={cn(i === idx ? "text-foreground" : "text-muted-foreground")}>
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

function ScaleSlider({
  label,
  value,
  ends,
  onChange,
}: {
  label: string;
  value: number;
  ends: [string, string];
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[11px] tabular-nums text-foreground/70">
          {value}/{SLIDER_MAX}
        </span>
      </div>
      <Slider
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={1}
        value={[value]}
        onValueChange={(v) =>
          onChange(Array.isArray(v) ? (v[0] ?? value) : (v as number))
        }
      />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-orange-300/50 bg-orange-500/15 text-orange-100"
          : "border-border bg-background/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function QuestionsStep({
  recipient,
  answers,
  set,
  setCloseness,
  setRemember,
  setTone,
  toggleGoal,
  onBack,
  onGenerate,
  pending,
}: {
  recipient: EmailTemplateContactHit;
  answers: BuilderAnswers;
  set: <K extends keyof BuilderAnswers>(key: K, value: BuilderAnswers[K]) => void;
  setCloseness: (n: number) => void;
  setRemember: (n: number) => void;
  setTone: (n: number) => void;
  toggleGoal: (key: string) => void;
  onBack: () => void;
  onGenerate: () => void;
  pending: boolean;
}) {
  return (
    <section className="space-y-6 rounded-xl border bg-card p-5">
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
          Tell me about the relationship
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Writing to{" "}
          <span className="text-foreground">
            {recipient.name}
            {recipient.firm ? ` · ${recipient.firm}` : ""}
            {recipient.email ? ` · ${recipient.email}` : ""}
          </span>
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <ScaleSlider
          label="How close are you?"
          value={answers.closeness}
          ends={CLOSENESS_ENDS}
          onChange={setCloseness}
        />
        <ScaleSlider
          label="Will they remember you?"
          value={answers.remember}
          ends={REMEMBER_ENDS}
          onChange={setRemember}
        />
        <ScaleSlider
          label="Tone"
          value={answers.tone}
          ends={TONE_ENDS}
          onChange={setTone}
        />
        <div className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            When did you last speak?
          </span>
          <div className="flex flex-wrap gap-1.5">
            {LAST_SPOKE_OPTIONS.map((o) => (
              <Chip
                key={o.key}
                active={answers.lastSpoke === o.key}
                onClick={() => set("lastSpoke", o.key)}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          What are you hoping to get out of it?{" "}
          <span className="font-normal normal-case text-muted-foreground/70">
            (pick any)
          </span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_OPTIONS.map((o) => (
            <Chip
              key={o.key}
              active={answers.goals.includes(o.key)}
              onClick={() => toggleGoal(o.key)}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Draft length
        </span>
        <div className="flex flex-wrap gap-1.5">
          {LENGTH_OPTIONS.map((o) => (
            <Chip
              key={o.key}
              active={answers.length === o.key}
              onClick={() => set("length", o.key as Length)}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            How do you know them?{" "}
            <span className="font-normal normal-case text-muted-foreground/70">
              (optional)
            </span>
          </span>
          <Textarea
            value={answers.relationship}
            onChange={(e) => set("relationship", e.target.value)}
            placeholder="Former colleague at Omnicom; we ran the APAC pitch together."
            className="min-h-[72px] text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Anything specific to reference?{" "}
            <span className="font-normal normal-case text-muted-foreground/70">
              (optional)
            </span>
          </span>
          <Textarea
            value={answers.detail}
            onChange={(e) => set("detail", e.target.value)}
            placeholder="Saw they just raised a Series B; shared memory of the 2014 offsite."
            className="min-h-[72px] text-sm"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Is there a concrete ask?{" "}
          <span className="font-normal normal-case text-muted-foreground/70">
            (optional)
          </span>
        </span>
        <Input
          value={answers.ask}
          onChange={(e) => set("ask", e.target.value)}
          placeholder="15 minutes next week to get your read on the RMN market."
          className="h-9 text-sm"
        />
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" onClick={onGenerate} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Drafting…
            </>
          ) : (
            <>
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Generate draft
            </>
          )}
        </Button>
      </div>
    </section>
  );
}

function PreviewStep({
  recipient,
  draft,
  onChange,
  onBack,
  onRegenerate,
  onOpenMail,
  onCopy,
  onStartOver,
  pending,
}: {
  recipient: EmailTemplateContactHit;
  draft: BuilderDraft;
  onChange: (d: BuilderDraft) => void;
  onBack: () => void;
  onRegenerate: () => void;
  onOpenMail: () => void;
  onCopy: () => void;
  onStartOver: () => void;
  pending: boolean;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveTemplate = async () => {
    const title = saveTitle.trim();
    if (!title) {
      toast.error("Give the template a name.");
      return;
    }
    setSaving(true);
    const res = await saveCustomEmailTemplate({
      title,
      subject: draft.subject,
      body: draft.body,
      recipientName: recipient.name,
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setSaveOpen(false);
      setSaveTitle("");
      toast.success("Saved. It's in the Templates tab now.");
    } else {
      toast.error(res.error);
    }
  };

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
            Edit answers
          </button>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Sparkles className="h-3.5 w-3.5 text-orange-300" />
            Your draft
          </h2>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
            Tweak anything below, then open Apple Mail with To, subject, and
            body filled in. Do the final edit and send there - JasonOS picks up
            the send from your synced inbox.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Regenerate
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSaveOpen((o) => !o)}
          >
            {saved ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
            )}
            {saved ? "Saved" : "Save as template"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCopy}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy
          </Button>
          <Button type="button" size="sm" onClick={onOpenMail}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Open in Apple Mail
          </Button>
        </div>
      </div>

      {saveOpen ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-orange-300/30 bg-orange-500/5 p-3">
          <label className="min-w-[220px] flex-1 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Template name
            </span>
            <Input
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder="Warm reconnect - ask for a meeting"
              className="h-9 text-sm"
              autoFocus
            />
          </label>
          <Button type="button" size="sm" onClick={saveTemplate} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save
          </Button>
          <p className="w-full text-[11px] text-muted-foreground">
            {recipient.name.split(/\s+/)[0]}&rsquo;s name is swapped for a
            placeholder so you can reuse this with anyone.
          </p>
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border bg-background/50 p-4">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            To
          </p>
          <p className="text-sm text-foreground">{recipient.email ?? "-"}</p>
        </div>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Subject
          </span>
          <Input
            value={draft.subject}
            onChange={(e) => onChange({ ...draft, subject: e.target.value })}
            className="h-9 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Body
          </span>
          <Textarea
            value={draft.body}
            onChange={(e) => onChange({ ...draft, body: e.target.value })}
            className="min-h-[280px] font-sans text-sm leading-relaxed"
          />
        </label>
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
