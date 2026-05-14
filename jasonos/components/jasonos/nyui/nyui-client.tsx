"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, FileDown, X, CheckCircle2 } from "lucide-react";
import {
  addWorkSearch,
  addBusinessHours,
  getExportData,
  type NyuiWeekData,
  type WorkSearch,
  type BusinessHour,
} from "@/lib/server-actions/nyui";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTACT_METHODS = [
  "Online Portal",
  "Direct Email",
  "Phone Call",
  "LinkedIn",
  "Networking Event",
  "Interview",
];
const RESULT_OPTIONS = [
  "Application Submitted",
  "Interview Scheduled",
  "Pending",
  "Rejected",
  "Offer Received",
];
const ENTITIES = ["Kuperman Ventures LLC", "Kuperman Advisors LLC"];

const WEEKLY_LIMIT = 10 * 60;
const WARN_THRESHOLD = 8 * 60;
const DAILY_LIMIT = 10 * 60;

// ─── Utilities ────────────────────────────────────────────────────────────────

function entryMins(e: BusinessHour) {
  return e.hours * 60 + e.minutes;
}

function fmtHm(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function buildCSV(columns: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = columns.map((c) => esc(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => esc(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}

// ─── Shared UI Primitives ─────────────────────────────────────────────────────

function Field({
  label,
  required = false,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {hint && <span className="ml-1 font-normal text-muted-foreground">({hint})</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50";
const selectCls = inputCls + " appearance-none";

function StatusBadge({
  variant,
  children,
}: {
  variant: "success" | "warning" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const styles = {
    success: "bg-green-500/15 text-green-400",
    warning: "bg-amber-500/15 text-amber-400",
    danger: "bg-red-500/15 text-red-400",
    neutral: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

function WarningBanner({
  variant,
  title,
  children,
}: {
  variant: "warning" | "danger";
  title: string;
  children?: React.ReactNode;
}) {
  const styles = {
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    danger: "bg-red-500/10 border-red-500/30 text-red-300",
  };
  return (
    <div className={`rounded-lg border p-3 mt-3 ${styles[variant]}`}>
      <p className="font-semibold text-sm flex items-center gap-1.5">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {title}
      </p>
      {children && <div className="mt-1 text-xs opacity-90">{children}</div>}
    </div>
  );
}

function ProgressBar({
  pct,
  variant = "default",
}: {
  pct: number;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const colors = {
    default: "bg-foreground",
    success: "bg-green-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  };
  return (
    <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colors[variant]}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ onClose }: { onClose: () => void }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!startDate || !endDate) {
      setError("Please select both dates.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after start date.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await getExportData(startDate, endDate);
      if (result.error) throw new Error(result.error);

      const wsCols = [
        { key: "date", label: "Date" },
        { key: "company_name", label: "Company / Organization" },
        { key: "company_location", label: "Location / URL" },
        { key: "contact_method", label: "Contact Method" },
        { key: "contact_person", label: "Contact Person" },
        { key: "position_applied", label: "Position Applied For" },
        { key: "result", label: "Result" },
        { key: "created_at", label: "Date Logged" },
      ];
      const bhCols = [
        { key: "date", label: "Date" },
        { key: "entity", label: "Entity" },
        { key: "activity_description", label: "Activity Description" },
        { key: "hours", label: "Hours" },
        { key: "minutes", label: "Minutes" },
        { key: "created_at", label: "Date Logged" },
      ];

      const ws = result.workSearches as unknown as Record<string, unknown>[];
      const bh = result.businessHours as unknown as Record<string, unknown>[];
      const report = [
        `"NYS DOL COMPLIANCE AUDIT REPORT"`,
        `"Date Range: ${startDate} to ${endDate}"`,
        `"Generated: ${new Date().toLocaleString()}"`,
        "",
        "",
        `"=== SECTION 1: WORK SEARCH LOG (${ws.length} records) ==="`,
        buildCSV(wsCols, ws),
        "",
        "",
        `"=== SECTION 2: BUSINESS HOURS LOG (${bh.length} records) ==="`,
        buildCSV(bhCols, bh),
      ].join("\n");

      const blob = new Blob([report], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nys-dol-audit-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-semibold text-foreground">Generate NYS DOL Audit Report</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Downloads a CSV with Work Search and Business Hours data
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-md p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date" required>
              <input
                type="date"
                className={inputCls}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="End Date" required>
              <input
                type="date"
                className={inputCls}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={loading || !startDate || !endDate}
              className="flex-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              {loading ? "Generating…" : "Download CSV"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function NYUIDashboard({
  workSearches,
  businessHours,
  weekStart,
  weekEnd,
  onNavigate,
}: {
  workSearches: WorkSearch[];
  businessHours: BusinessHour[];
  weekStart: string;
  weekEnd: string;
      onNavigate: (screen: SubScreen) => void;
}) {
  const [showExport, setShowExport] = useState(false);

  const startDisplay = new Date(weekStart + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const endDisplay = new Date(weekEnd + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Work search analysis
  const uniqueDays = new Set(workSearches.map((w) => w.date)).size;
  const wsProgressPct = (Math.min(uniqueDays, 3) / 3) * 100;
  const goalMet = uniqueDays >= 3;

  const wsByDate = workSearches.reduce<Record<string, WorkSearch[]>>((acc, ws) => {
    acc[ws.date] = acc[ws.date] ? [...acc[ws.date], ws] : [ws];
    return acc;
  }, {});

  // Business hours analysis
  const totalMins = businessHours.reduce((s, e) => s + entryMins(e), 0);
  const venturesMins = businessHours
    .filter((e) => e.entity === "Kuperman Ventures LLC")
    .reduce((s, e) => s + entryMins(e), 0);
  const advisorsMins = businessHours
    .filter((e) => e.entity === "Kuperman Advisors LLC")
    .reduce((s, e) => s + entryMins(e), 0);

  const dayTotals = businessHours.reduce<Record<string, number>>((acc, e) => {
    acc[e.date] = (acc[e.date] ?? 0) + entryMins(e);
    return acc;
  }, {});
  const daysOverDailyLimit = Object.entries(dayTotals).filter(([, m]) => m > DAILY_LIMIT);
  const bhProgressPct = (totalMins / WEEKLY_LIMIT) * 100;
  const bhVariant =
    totalMins >= WEEKLY_LIMIT ? "danger" : totalMins >= WARN_THRESHOLD ? "warning" : "default";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">NYS DOL — Weekly Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {startDisplay} – {endDisplay}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowExport(true)}
          className="inline-flex items-center gap-2 self-start rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80 shadow-sm"
        >
          <FileDown className="h-4 w-4" />
          Audit Report
        </button>
      </div>

      {/* Work Search Progress */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h3 className="font-semibold text-foreground">Work Search Progress</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Requires 3 activities on 3 separate calendar days
            </p>
          </div>
          {goalMet ? (
            <StatusBadge variant="success">
              <CheckCircle2 className="h-3 w-3" /> Goal Met
            </StatusBadge>
          ) : (
            <StatusBadge variant={uniqueDays >= 2 ? "warning" : "neutral"}>
              {uniqueDays} / 3 days
            </StatusBadge>
          )}
        </div>

        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>{uniqueDays} of 3 qualifying days</span>
          <span>
            {workSearches.length} total activit{workSearches.length !== 1 ? "ies" : "y"} this week
          </span>
        </div>
        <ProgressBar pct={wsProgressPct} variant={goalMet ? "success" : "default"} />

        {workSearches.length > 0 && uniqueDays < workSearches.length && (
          <p className="mt-3 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
            {workSearches.length - uniqueDays} activit
            {workSearches.length - uniqueDays !== 1 ? "ies" : "y"} logged on a day already counted
            — only unique days count toward the 3-day goal.
          </p>
        )}

        {Object.keys(wsByDate).length > 0 ? (
          <div className="mt-4 divide-y divide-border rounded-lg border border-border overflow-hidden">
            {Object.keys(wsByDate)
              .sort()
              .map((date) =>
                wsByDate[date].map((ws, i) => (
                  <div
                    key={ws.id}
                    className="grid grid-cols-[104px_1fr_auto] gap-3 px-3 py-2.5 text-sm items-start"
                  >
                    <span
                      className={`font-medium tabular-nums text-xs pt-0.5 ${
                        i > 0 ? "text-muted-foreground/40" : "text-muted-foreground"
                      }`}
                    >
                      {i === 0 ? fmtDate(date) : "↳ same day"}
                    </span>
                    <div>
                      <p className="font-medium text-foreground leading-snug">{ws.company_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ws.position_applied} · {ws.contact_method}
                      </p>
                    </div>
                    <StatusBadge
                      variant={
                        ws.result === "Offer Received"
                          ? "success"
                          : ws.result === "Interview Scheduled"
                          ? "warning"
                          : ws.result === "Rejected"
                          ? "danger"
                          : "neutral"
                      }
                    >
                      {ws.result}
                    </StatusBadge>
                  </div>
                ))
              )}
          </div>
        ) : (
          <div className="mt-4 text-center py-8">
            <Clock className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No work search activities logged this week
            </p>
            <button
              type="button"
              onClick={() => onNavigate("log-work-search")}
              className="mt-2 text-xs text-foreground underline underline-offset-2"
            >
              Log your first activity →
            </button>
          </div>
        )}
      </div>

      {/* Business Hours Ledger */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h3 className="font-semibold text-foreground">Business Hours Ledger</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Combined limit: 10h/week · 10h/day
            </p>
          </div>
          {totalMins >= WEEKLY_LIMIT ? (
            <StatusBadge variant="danger">⚠ Limit Exceeded</StatusBadge>
          ) : totalMins >= WARN_THRESHOLD ? (
            <StatusBadge variant="warning">Approaching Limit</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">{fmtHm(totalMins)} logged</StatusBadge>
          )}
        </div>

        {totalMins >= WEEKLY_LIMIT && (
          <WarningBanner variant="danger" title="Weekly Limit Exceeded — UI Payout at Risk">
            <p>
              You have logged <strong>{fmtHm(totalMins)}</strong> this week. Exceeding 10 combined
              hours triggers a <strong>0% UI payout</strong> for this week.
            </p>
          </WarningBanner>
        )}
        {totalMins >= WARN_THRESHOLD && totalMins < WEEKLY_LIMIT && (
          <WarningBanner variant="warning" title="Approaching Weekly Limit">
            <p>
              You have logged <strong>{fmtHm(totalMins)}</strong>. Only{" "}
              <strong>{fmtHm(WEEKLY_LIMIT - totalMins)}</strong> remaining before the 10-hour
              limit.
            </p>
          </WarningBanner>
        )}
        {daysOverDailyLimit.map(([date, mins]) => (
          <WarningBanner key={date} variant="danger" title={`Daily Limit Exceeded — ${fmtDate(date)}`}>
            <p>
              <strong>{fmtHm(mins)}</strong> logged on this day, exceeding the 10-hour daily
              threshold.
            </p>
          </WarningBanner>
        ))}

        <div
          className={`flex justify-between text-xs text-muted-foreground mb-1.5 ${
            totalMins >= WARN_THRESHOLD ? "mt-4" : ""
          }`}
        >
          <span>{fmtHm(totalMins)}</span>
          <span>of 10h weekly limit</span>
        </div>
        <ProgressBar pct={bhProgressPct} variant={bhVariant} />

        <div className="mt-4 rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Entity
                </th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  This Week
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-3 text-foreground">Kuperman Ventures LLC</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                  {fmtHm(venturesMins)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-foreground">Kuperman Advisors LLC</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                  {fmtHm(advisorsMins)}
                </td>
              </tr>
              <tr className="bg-muted">
                <td className="px-4 py-3 font-semibold text-foreground">Combined Total</td>
                <td
                  className={`px-4 py-3 text-right tabular-nums font-semibold ${
                    totalMins >= WEEKLY_LIMIT
                      ? "text-red-400"
                      : totalMins >= WARN_THRESHOLD
                      ? "text-amber-400"
                      : "text-foreground"
                  }`}
                >
                  {fmtHm(totalMins)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {businessHours.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              This Week&apos;s Entries
            </p>
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {businessHours.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[104px_1fr_auto] gap-3 px-3 py-2.5 text-sm items-start"
                >
                  <span className="font-medium text-muted-foreground text-xs pt-0.5 whitespace-nowrap">
                    {fmtDate(entry.date)}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      {entry.entity}
                    </p>
                    <p className="text-foreground leading-snug">{entry.activity_description}</p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-foreground whitespace-nowrap pt-0.5">
                    {fmtHm(entryMins(entry))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-center py-8">
            <Clock className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No business hours logged this week</p>
            <button
              type="button"
              onClick={() => onNavigate("log-business-hours")}
              className="mt-2 text-xs text-foreground underline underline-offset-2"
            >
              Log hours →
            </button>
          </div>
        )}
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  );
}

// ─── Work Search Form ─────────────────────────────────────────────────────────

function WorkSearchForm({
  onSuccess,
  onBack,
}: {
  onSuccess: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    date: todayStr(),
    company_name: "",
    company_location: "",
    contact_method: "",
    contact_person: "",
    position_applied: "",
    result: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.date) e.date = "Required";
    if (!form.company_name.trim()) e.company_name = "Required";
    if (!form.company_location.trim()) e.company_location = "Required";
    if (!form.contact_method) e.contact_method = "Required";
    if (!form.position_applied.trim()) e.position_applied = "Required";
    if (!form.result) e.result = "Required";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setServerError(null);
    startTransition(async () => {
      const result = await addWorkSearch({
        date: form.date,
        company_name: form.company_name.trim(),
        company_location: form.company_location.trim(),
        contact_method: form.contact_method,
        contact_person: form.contact_person.trim() || null,
        position_applied: form.position_applied.trim(),
        result: form.result,
      });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
      setTimeout(onSuccess, 1000);
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
        >
          ← Back to Dashboard
        </button>
        <h2 className="text-lg font-bold text-foreground">Log Work Search Activity</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Record each contact or application attempt for NYS DOL compliance.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {done ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-foreground">Activity logged successfully</p>
            <p className="text-sm text-muted-foreground mt-1">Returning to dashboard…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {serverError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <Field label="Date" required error={errors.date}>
              <input type="date" className={inputCls} value={form.date} onChange={set("date")} />
            </Field>

            <Field label="Company / Organization Name" required error={errors.company_name}>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g., Acme Corporation"
                value={form.company_name}
                onChange={set("company_name")}
              />
            </Field>

            <Field
              label="Physical Address, Email, or Web URL"
              required
              error={errors.company_location}
            >
              <input
                type="text"
                className={inputCls}
                placeholder="e.g., https://careers.acme.com or 123 Main St, New York, NY"
                value={form.company_location}
                onChange={set("company_location")}
              />
            </Field>

            <Field label="Contact Method" required error={errors.contact_method}>
              <select
                className={selectCls}
                value={form.contact_method}
                onChange={set("contact_method")}
              >
                <option value="">Select contact method…</option>
                {CONTACT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Name & Title of Person Contacted" hint="optional">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g., Jane Smith, VP of Talent Acquisition"
                value={form.contact_person}
                onChange={set("contact_person")}
              />
            </Field>

            <Field label="Position Applied For" required error={errors.position_applied}>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g., Chief Marketing Officer, SVP Marketing, Board Member"
                value={form.position_applied}
                onChange={set("position_applied")}
              />
            </Field>

            <Field label="Result" required error={errors.result}>
              <select className={selectCls} value={form.result} onChange={set("result")}>
                <option value="">Select result…</option>
                {RESULT_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md bg-foreground py-2.5 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Submitting…" : "Log Work Search Activity"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Business Hours Form ──────────────────────────────────────────────────────

function BusinessHoursForm({
  onSuccess,
  onBack,
}: {
  onSuccess: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    date: todayStr(),
    entity: "",
    activity_description: "",
    hours: "0",
    minutes: "0",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set(field: string) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.date) e.date = "Required";
    if (!form.entity) e.entity = "Required";
    if (!form.activity_description.trim()) e.activity_description = "Required";
    const h = parseInt(form.hours, 10);
    const m = parseInt(form.minutes, 10);
    if (isNaN(h) || h < 0 || h > 24) e.hours = "Must be 0–24";
    if (isNaN(m) || m < 0 || m > 59) e.minutes = "Must be 0–59";
    if (!isNaN(h) && !isNaN(m) && h === 0 && m === 0) e.hours = "Time must be greater than 0";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setServerError(null);
    startTransition(async () => {
      const result = await addBusinessHours({
        date: form.date,
        entity: form.entity,
        activity_description: form.activity_description.trim(),
        hours: parseInt(form.hours, 10),
        minutes: parseInt(form.minutes, 10),
      });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
      setTimeout(onSuccess, 1000);
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
        >
          ← Back to Dashboard
        </button>
        <h2 className="text-lg font-bold text-foreground">Log Business Hours</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Record operational work for Kuperman Ventures LLC or Kuperman Advisors LLC. Combined
          weekly hours must stay under 10.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {done ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-foreground">Hours logged successfully</p>
            <p className="text-sm text-muted-foreground mt-1">Returning to dashboard…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {serverError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <Field label="Date" required error={errors.date}>
              <input type="date" className={inputCls} value={form.date} onChange={set("date")} />
            </Field>

            <Field label="Entity" required error={errors.entity}>
              <select className={selectCls} value={form.entity} onChange={set("entity")}>
                <option value="">Select entity…</option>
                {ENTITIES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Activity Description" required error={errors.activity_description}>
              <textarea
                className={inputCls + " min-h-[100px] resize-y"}
                placeholder="Detailed description of operational activity performed…"
                value={form.activity_description}
                onChange={set("activity_description")}
              />
            </Field>

            <Field label="Time Spent" required error={errors.hours || errors.minutes}>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="24"
                    className={inputCls + " w-20 text-center"}
                    value={form.hours}
                    onChange={set("hours")}
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    className={inputCls + " w-20 text-center"}
                    value={form.minutes}
                    onChange={set("minutes")}
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
            </Field>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md bg-foreground py-2.5 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Submitting…" : "Log Business Hours"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Root Client Component ────────────────────────────────────────────────────

type SubScreen = "dashboard" | "log-work-search" | "log-business-hours";

const SUB_NAV: { id: SubScreen; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "log-work-search", label: "Log Work Search" },
  { id: "log-business-hours", label: "Log Business Hours" },
];

export function NyuiClient({
  initialData,
  weekStart,
  weekEnd,
}: {
  initialData: NyuiWeekData;
  weekStart: string;
  weekEnd: string;
}) {
  const [subScreen, setSubScreen] = useState<SubScreen>("dashboard");

  return (
    <section className="pb-4">
      <div className="flex gap-1 mb-6 border-b border-border">
        {SUB_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSubScreen(item.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              subScreen === item.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {subScreen === "dashboard" && (
        <NYUIDashboard
          workSearches={initialData.workSearches}
          businessHours={initialData.businessHours}
          weekStart={weekStart}
          weekEnd={weekEnd}
          onNavigate={setSubScreen}
        />
      )}
      {subScreen === "log-work-search" && (
        <WorkSearchForm
          onSuccess={() => setSubScreen("dashboard")}
          onBack={() => setSubScreen("dashboard")}
        />
      )}
      {subScreen === "log-business-hours" && (
        <BusinessHoursForm
          onSuccess={() => setSubScreen("dashboard")}
          onBack={() => setSubScreen("dashboard")}
        />
      )}
    </section>
  );
}
