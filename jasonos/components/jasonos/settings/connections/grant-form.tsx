"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_ORDER } from "@/lib/connections/logic";
import { STATUS_LABEL, type ConnectionGrant, type GrantStatus } from "@/lib/connections/types";
import {
  createGrantAction,
  editGrantAction,
  type GrantFormValues,
} from "@/lib/server-actions/connections";

const EMPTY: GrantFormValues = {
  identity: "",
  hub: "",
  target: "",
  access: "",
  used_by: "",
  status: "unverified",
  evidence: "",
  check_at: "",
};

const FIELDS: { key: Exclude<keyof GrantFormValues, "status">; label: string; placeholder: string; wide?: boolean; required?: boolean }[] = [
  { key: "identity", label: "Account (identity)", placeholder: "jason@kupermanadvisors.com", required: true },
  { key: "hub", label: "Tool holding the access", placeholder: "Zapier", required: true },
  { key: "target", label: "App it reaches", placeholder: "Gmail", required: true },
  { key: "access", label: "What it can do", placeholder: "Read and send mail", wide: true },
  { key: "used_by", label: "What uses it", placeholder: "Name of the Zap, agent, task or app, or 'Nothing found'", wide: true },
  { key: "evidence", label: "Evidence", placeholder: "Where you saw it, and when", wide: true },
  { key: "check_at", label: "Where to check or revoke", placeholder: "https://... or a menu path", wide: true },
];

export function GrantForm({ grant, onDone }: { grant: ConnectionGrant | null; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<GrantFormValues>(
    grant
      ? {
          identity: grant.identity,
          hub: grant.hub,
          target: grant.target,
          access: grant.access,
          used_by: grant.used_by,
          status: grant.status,
          evidence: grant.evidence,
          check_at: grant.check_at,
        }
      : EMPTY
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = grant ? await editGrantAction(grant.id, values) : await createGrantAction(values);
      if (res.ok) {
        toast.success(grant ? "Grant updated" : "Grant saved");
        router.refresh();
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <h2 className="text-sm font-semibold sm:col-span-2 lg:col-span-4">{grant ? "Edit grant" : "Add a grant"}</h2>
      {FIELDS.map((f) => (
        <label
          key={f.key}
          htmlFor={`grant-form-${f.key}`}
          className={f.wide ? "grid gap-1 text-[12px] text-[var(--jos-muted)] sm:col-span-2" : "grid gap-1 text-[12px] text-[var(--jos-muted)]"}
        >
          {f.label}
          <Input
            id={`grant-form-${f.key}`}
            value={values[f.key]}
            required={f.required}
            placeholder={f.placeholder}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        </label>
      ))}
      <label htmlFor="grant-form-status" className="grid gap-1 text-[12px] text-[var(--jos-muted)]">
        Status
        <select
          id="grant-form-status"
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as GrantStatus }))}
          className="h-10 rounded-[2px] border border-[var(--jos-line)] bg-transparent px-3 text-sm text-[var(--jos-ink)]"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {grant ? "Save changes" : "Save grant"}
        </Button>
      </div>
    </form>
  );
}
