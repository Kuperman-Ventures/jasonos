"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { fybMarkdownComponents } from "@/components/jasonos/fuck-you-batman/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { dataFieldValue } from "@/lib/fuck-you-batman/logic";
import {
  FYB_ENTRY_STATUS_LABEL,
  type FybDataField,
  type FybEntry,
} from "@/lib/fuck-you-batman/types";
import { approveFybEntry, requestFybEntryChanges } from "@/lib/server-actions/fuck-you-batman";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function EntryCard({
  entry,
  fields = [],
  displayValues,
}: {
  entry: FybEntry;
  fields?: FybDataField[];
  displayValues?: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const docUrl = typeof entry.data.doc_url === "string" ? entry.data.doc_url : "";

  const approve = async () => {
    setBusy(true);
    const result = await approveFybEntry(entry.kind, entry.entry_key);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Approved.");
    router.refresh();
  };

  const sendChanges = async () => {
    if (!note.trim()) {
      toast.error("Write the change you want.");
      return;
    }
    setBusy(true);
    const result = await requestFybEntryChanges(entry.kind, entry.entry_key, note);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Change request sent.");
    setAsking(false);
    setNote("");
    router.refresh();
  };

  return (
    <section className="rounded-xl border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {FYB_ENTRY_STATUS_LABEL[entry.status]}
      </p>
      <h3 className="mt-1 text-sm font-semibold">{entry.title}</h3>

      {fields.length > 0 ? (
        <dl className="mt-2 space-y-1 text-xs">
          {fields.map((field) => {
            const value = displayValues?.[field.key] ?? dataFieldValue(entry, field.key);
            if (!value) return null;
            return (
              <div key={field.key} className="flex gap-2">
                <dt className="shrink-0 font-semibold text-foreground">{field.label}</dt>
                <dd className="text-foreground/80">{value}</dd>
              </div>
            );
          })}
        </dl>
      ) : null}

      {docUrl.startsWith("https://") ? (
        <p className="mt-2 text-xs">
          <a href={docUrl} target="_blank" rel="noreferrer" className="underline">
            Chapter doc
          </a>
        </p>
      ) : null}

      {entry.status === "changes_requested" && entry.change_request ? (
        <p className="mt-2 text-xs text-foreground/80">
          <span className="font-semibold text-foreground">Change request</span>
          {entry.change_requested_at ? ` · ${formatDate(entry.change_requested_at)}` : ""}:{" "}
          {entry.change_request}
        </p>
      ) : null}

      {entry.body_md.trim() ? (
        <div className="mt-2">
          <ReactMarkdown components={fybMarkdownComponents}>{entry.body_md}</ReactMarkdown>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.status !== "approved" ? (
          <Button type="button" size="sm" disabled={busy} onClick={approve}>
            Approve
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setAsking((v) => !v)}>
          Request changes
        </Button>
      </div>

      {asking ? (
        <div className="mt-2 space-y-2">
          <Textarea
            rows={3}
            value={note}
            placeholder="What should change."
            onChange={(event) => setNote(event.target.value)}
          />
          <Button type="button" size="sm" disabled={busy} onClick={sendChanges}>
            Send
          </Button>
        </div>
      ) : null}
    </section>
  );
}
