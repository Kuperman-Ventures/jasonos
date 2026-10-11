"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/jasonos/brand/status";
import { STATUS_ORDER, formatVerified, isHttpUrl, statusRung } from "@/lib/connections/logic";
import { STATUS_LABEL, type ConnectionGrant, type GrantStatus } from "@/lib/connections/types";
import {
  deleteGrantAction,
  markGrantVerifiedAction,
  setGrantStatusAction,
} from "@/lib/server-actions/connections";

type ActionResult = { ok: true } | { ok: false; error: string };

export function CheckLink({ value, label = "Open" }: { value: string; label?: string }) {
  if (!value) return null;
  return isHttpUrl(value) ? (
    <a href={value} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--jos-action)] underline underline-offset-2">
      {label}
    </a>
  ) : (
    <span>{value}</span>
  );
}

export function RegisterTable({
  grants,
  onEdit,
}: {
  grants: ConnectionGrant[];
  onEdit: (grant: ConnectionGrant) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function act(fn: () => Promise<ActionResult>, done: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(done);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!grants.length) {
    return (
      <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-[var(--jos-muted)]">
        No grants match the current search and filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[1040px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-widest text-[var(--jos-muted)]">
            <th className="px-3 py-3">Account</th>
            <th className="px-3 py-3">Tool holding access</th>
            <th className="px-3 py-3">App it reaches</th>
            <th className="px-3 py-3">What uses it</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Last verified</th>
            <th className="px-3 py-3">Update</th>
          </tr>
        </thead>
        <tbody>
          {grants.map((g) => (
            <tr key={g.id} className="border-t border-[var(--jos-line)] align-top">
              <td className="num-mono px-3 py-3 text-[12px] break-words">{g.identity}</td>
              <td className="px-3 py-3">
                <p className="font-semibold">{g.hub}</p>
                {g.check_at ? (
                  <p className="mt-1 text-[12px] text-[var(--jos-muted)]">
                    Check or revoke: <CheckLink value={g.check_at} />
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-3">
                <p className="font-semibold">{g.target}</p>
                <p className="mt-1 text-[12px] text-[var(--jos-muted)]">{g.access}</p>
              </td>
              <td className="px-3 py-3">
                <p>{g.used_by}</p>
                <p className="mt-1 text-[12px] text-[var(--jos-muted)]">{g.evidence}</p>
              </td>
              <td className="px-3 py-3">
                <StatusPill rung={statusRung(g.status)}>{STATUS_LABEL[g.status]}</StatusPill>
              </td>
              <td className="num-mono px-3 py-3 text-[12px] whitespace-nowrap">{formatVerified(g.verified_on)}</td>
              <td className="px-3 py-3">
                <div className="grid min-w-[160px] gap-1.5">
                  <select
                    id={`grant-status-${g.id}`}
                    aria-label={`Change status for ${g.hub} to ${g.target}`}
                    value={g.status}
                    disabled={pending}
                    onChange={(e) =>
                      act(() => setGrantStatusAction(g.id, e.target.value as GrantStatus), "Status updated")
                    }
                    className="h-8 rounded-[2px] border border-[var(--jos-line)] bg-transparent px-2 text-[13px]"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={pending}
                    onClick={() => act(() => markGrantVerifiedAction(g.id), "Marked verified today")}
                  >
                    Mark verified today
                  </Button>
                  <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => onEdit(g)}>
                    Edit
                  </Button>
                  {confirmId === g.id ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => {
                        setConfirmId(null);
                        act(() => deleteGrantAction(g.id), "Row removed");
                      }}
                    >
                      Confirm remove
                    </Button>
                  ) : (
                    <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => setConfirmId(g.id)}>
                      Remove row
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
