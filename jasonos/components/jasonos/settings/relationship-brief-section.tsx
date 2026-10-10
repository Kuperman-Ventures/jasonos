"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/jasonos/brand/page-header";
import {
  CadenceBlock,
  PillChip,
  WordPill,
  modalFieldClass,
  modalHelperClass,
  modalLabelClass,
  modalSecondaryClass,
} from "@/components/jasonos/contact-modal/parts";
import {
  BRIEF_SECTION_KEYS,
  BRIEF_SECTION_LABELS,
  DEFAULT_RELATIONSHIP_BRIEF_PROMPT,
  RELATIONSHIP_BRIEF_VARIABLES,
  missingRequiredBriefVariables,
  unknownBriefVariables,
  type BriefSectionFlags,
  type BriefSectionKey,
} from "@/lib/outreach/relationship-brief";
import { searchContacts } from "@/lib/server-actions/outreach";
import { generateRelationshipBrief } from "@/lib/server-actions/relationship-brief";
import type { RelationshipBrief } from "@/lib/outreach/relationship-brief-types";
import type { SettingsPayload } from "@/lib/settings/data";

export function RelationshipBriefSection({
  initial,
}: {
  initial: Pick<
    SettingsPayload,
    | "relationshipBriefPrompt"
    | "relationshipBriefPromptCustom"
    | "relationshipBriefPromptDefault"
    | "relationshipBriefPromptVersion"
    | "relationshipBriefSections"
    | "relationshipBriefPromptUpdatedAt"
  >;
}) {
  const [prompt, setPrompt] = useState(initial.relationshipBriefPrompt);
  const [custom, setCustom] = useState(initial.relationshipBriefPromptCustom);
  const [version, setVersion] = useState(initial.relationshipBriefPromptVersion);
  const [sections, setSections] = useState<BriefSectionFlags>(
    initial.relationshipBriefSections
  );
  const [savedAt, setSavedAt] = useState(
    initial.relationshipBriefPromptUpdatedAt
  );
  const [savedPrompt, setSavedPrompt] = useState(initial.relationshipBriefPrompt);
  const [saving, startSaving] = useTransition();
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const [testQuery, setTestQuery] = useState("");
  const [testHits, setTestHits] = useState<
    { id: string; name: string; firm: string | null }[]
  >([]);
  const [testContact, setTestContact] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [testing, startTesting] = useTransition();
  const [testBrief, setTestBrief] = useState<RelationshipBrief | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const unknown = useMemo(() => unknownBriefVariables(prompt), [prompt]);
  const missing = useMemo(
    () => missingRequiredBriefVariables(prompt),
    [prompt]
  );
  const dirty = prompt !== savedPrompt;
  const charCount = prompt.length;

  const insertVariable = (name: string) => {
    const el = areaRef.current;
    const token = `{{${name}}}`;
    if (!el) {
      setPrompt((p) => `${p}${token}`);
      return;
    }
    const start = el.selectionStart ?? prompt.length;
    const end = el.selectionEnd ?? prompt.length;
    const next = prompt.slice(0, start) + token + prompt.slice(end);
    setPrompt(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const save = (opts?: { reset?: boolean }) => {
    startSaving(async () => {
      const body = opts?.reset
        ? { prompt: "", reset: true, sections }
        : { prompt, sections };
      const res = await fetch("/api/settings/save-relationship-brief-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        prompt?: string;
        custom?: boolean;
        version?: number;
        sections?: BriefSectionFlags;
        updatedAt?: string;
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.prompt) {
        toast.error("Relationship brief prompt save failed", {
          description: payload.error ?? "Please try again.",
        });
        return;
      }
      setPrompt(payload.prompt);
      setSavedPrompt(payload.prompt);
      setCustom(Boolean(payload.custom));
      setVersion(payload.version ?? version);
      if (payload.sections) setSections(payload.sections);
      setSavedAt(payload.updatedAt ?? new Date().toISOString());
      toast.success(
        opts?.reset
          ? "Relationship brief prompt reset to default"
          : "Relationship brief prompt saved"
      );
    });
  };

  const runTest = () => {
    if (!testContact) return;
    startTesting(async () => {
      setTestError(null);
      const res = await generateRelationshipBrief({
        contactId: testContact.id,
        promptOverride: prompt,
        persist: false,
      });
      if (!res.ok) {
        setTestError(res.error);
        setTestBrief(null);
        setTestOpen(true);
        return;
      }
      setTestBrief(res.brief);
      setTestOpen(true);
    });
  };

  return (
    <section id="relationship-brief" className="mx-auto max-w-[760px] space-y-6">
      <PageHeader
        kicker="AI prompts"
        title="Relationship brief"
        description="The prompt used to write the brief on each contact's Dashboard."
      />

      <div>
        <label htmlFor="relationship-brief-prompt" className={modalLabelClass}>
          Prompt
        </label>
        <Textarea
          id="relationship-brief-prompt"
          ref={areaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          spellCheck
          className={`${modalFieldClass} mt-1 min-h-[300px] resize-y text-[15px] leading-[1.6]`}
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className={modalHelperClass}>
            {savedAt
              ? `Last saved ${new Date(savedAt).toLocaleString()}`
              : custom
                ? "Custom prompt"
                : "Using the shipped default"}
            {version ? ` · v${version}` : ""}
          </p>
          <p className="text-[13px] tabular-nums text-[var(--jos-muted)]">
            {charCount}
          </p>
        </div>
        <p className="mt-1 text-[13px] text-[var(--jos-muted)]">
          Output format and source citations are added automatically.
        </p>
        {unknown.length ? (
          <p className="mt-2 text-[13px] font-semibold text-[var(--color-accent-2-700)]">
            Unknown variables: {unknown.map((n) => `{{${n}}}`).join(", ")}
          </p>
        ) : null}
        {missing.length ? (
          <p className="mt-2 bg-rung-2 px-3 py-2 text-[13px] font-semibold text-[var(--color-text)]">
            Missing {missing.map((n) => `{{${n}}}`).join(" and ")}. You can still
            save — those sections may come back empty.
          </p>
        ) : null}
      </div>

      <div>
        <p className={modalLabelClass}>Insert variable</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RELATIONSHIP_BRIEF_VARIABLES.map((name) => (
            <PillChip
              key={name}
              selected={false}
              onClick={() => insertVariable(name)}
            >
              {`{{${name}}}`}
            </PillChip>
          ))}
        </div>
      </div>

      <div>
        <p className={modalLabelClass}>Sections to include</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BRIEF_SECTION_KEYS.map((key: BriefSectionKey) => (
            <CadenceBlock
              key={key}
              selected={sections[key]}
              onClick={() =>
                setSections((prev) => ({ ...prev, [key]: !prev[key] }))
              }
            >
              {BRIEF_SECTION_LABELS[key]}
            </CadenceBlock>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Input
              value={testContact ? testContact.name : testQuery}
              onChange={(e) => {
                setTestContact(null);
                const q = e.target.value;
                setTestQuery(q);
                if (q.trim().length < 2) {
                  setTestHits([]);
                  return;
                }
                void searchContacts(q).then(setTestHits);
              }}
              placeholder="Pick a contact to test"
              className={`${modalFieldClass} w-56`}
            />
            {testHits.length > 0 && !testContact ? (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto bg-[var(--color-bg)] shadow-[var(--shadow-lg)]">
                {testHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--color-surface)]"
                      onClick={() => {
                        setTestContact({ id: hit.id, name: hit.name });
                        setTestQuery(hit.name);
                        setTestHits([]);
                      }}
                    >
                      <span className="font-semibold">{hit.name}</span>
                      {hit.firm ? (
                        <span className="text-[var(--jos-muted)]">{hit.firm}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            className={modalSecondaryClass}
            disabled={!testContact || testing}
            onClick={runTest}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {testContact ? `Test on ${testContact.name}` : "Test on a contact"}
          </Button>
          <Button
            type="button"
            variant="link"
            disabled={saving}
            onClick={() => {
              if (
                !window.confirm(
                  "Reset to the shipped prompt? This saves immediately."
                )
              ) {
                return;
              }
              setPrompt(DEFAULT_RELATIONSHIP_BRIEF_PROMPT);
              save({ reset: true });
            }}
          >
            Reset to default
          </Button>
        </div>
        <Button
          type="button"
          disabled={saving || !dirty || unknown.length > 0}
          onClick={() => save()}
        >
          {saving ? "Saving..." : "Save prompt"}
        </Button>
      </div>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto rounded-[2px]">
          <DialogHeader>
            <DialogTitle>Test brief</DialogTitle>
            <DialogDescription>
              {testContact
                ? `Unsaved prompt on ${testContact.name}. Nothing was saved.`
                : "Nothing was saved."}
            </DialogDescription>
          </DialogHeader>
          {testError ? (
            <p className="bg-rung-1 px-3 py-2 text-[13px] font-semibold">
              Brief failed. {testError}
            </p>
          ) : testBrief ? (
            <div className="space-y-3 text-[14px]">
              {testBrief.summary ? <p>{testBrief.summary}</p> : null}
              {testBrief.nextMove ? (
                <WordPill
                  tone={
                    testBrief.nextMove.tone === "magenta"
                      ? "magenta"
                      : testBrief.nextMove.tone === "cyan"
                        ? "cyan"
                        : "yellow"
                  }
                >
                  {testBrief.nextMove.text}
                </WordPill>
              ) : (
                <p className="text-[var(--jos-muted)]">No next move returned.</p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
