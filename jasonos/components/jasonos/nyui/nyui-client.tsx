"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  FileDown,
  X,
  CheckCircle2,
  ChevronDown,
  Printer,
  Plus,
  Pencil,
  Trash2,
  Info,
  Loader2,
  Search,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  addWorkSearch,
  updateWorkSearch,
  deleteWorkSearch,
  addBusinessHoursBatch,
  updateBusinessHours,
  deleteBusinessHours,
  getExportData,
  type NyuiWeekData,
  type WorkSearch,
  type BusinessHour,
} from "@/lib/server-actions/nyui";
import {
  dismissResumeApplication,
  findCompanyUrl,
  markResumeApplicationLogged,
  type ResumeApplication,
} from "@/lib/server-actions/resume-applications";
import { recoverFromStaleServerAction } from "@/lib/client/stale-server-action";

type BusinessHoursPrefill = {
  date?: string;
  entity?: string;
  activity_category?: string;
  activity_description?: string;
  hours?: string;
  minutes?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTACT_METHODS = [
  // Original six — unchanged, kept first to preserve existing behavior.
  "Online Portal",
  "Direct Email",
  "Phone Call",
  "LinkedIn",
  "Networking Event",
  "Interview",
  // Added Jun 2026 (NYS DOL work-search review) — each validated as creditable.
  "In-Person Meeting",
  "Video Meeting",
  "Recruiter / Headhunter Screen",
  "Networking Contact",
  "Career-Center Advisor Meeting",
];
const RESULT_OPTIONS = [
  "Application Submitted",
  "Interview Scheduled",
  "Pending",
  "Rejected",
  "Offer Received",
];
const ENTITIES = ["Kuperman Ventures LLC", "Kuperman Advisors LLC"];

/** Categories for NYUI business-hours hourly breakdowns. */
const ACTIVITY_CATEGORIES = [
  "Material & Deliverable Developments",
  "Emails & Communications",
  "Project Management",
  "Research",
  "Strategy",
  "Meetings",
  "Sales & Business Development",
  "Product / Software Development",
  "Admin & Operations",
  "Finance & Legal",
  "Other",
] as const;

const DURATION_PRESETS = [
  { label: "15m", hours: 0, minutes: 15 },
  { label: "30m", hours: 0, minutes: 30 },
  { label: "45m", hours: 0, minutes: 45 },
  { label: "1h", hours: 1, minutes: 0 },
  { label: "1.5h", hours: 1, minutes: 30 },
  { label: "2h", hours: 2, minutes: 0 },
] as const;

type BreakdownRow = {
  key: string;
  category: string;
  hours: string;
  minutes: string;
  note: string;
};

function newBreakdownRow(partial?: Partial<BreakdownRow>): BreakdownRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: partial?.category ?? "",
    hours: partial?.hours ?? "0",
    minutes: partial?.minutes ?? "0",
    note: partial?.note ?? "",
  };
}

// ─── Two-tier ledger (Gap 1) ────────────────────────────────────────────────

type ActivityTier = "employer_contact" | "networking";

const TIER_LABELS: Record<ActivityTier, string> = {
  employer_contact: "Tier A — Employer Contact",
  networking: "Tier B — Networking / Fruitful Activity",
};
const TIER_SHORT: Record<ActivityTier, string> = {
  employer_contact: "Tier A",
  networking: "Tier B",
};

// Default tier derived from contact method; user can override in the form.
const TIER_BY_METHOD: Record<string, ActivityTier> = {
  "Online Portal": "employer_contact",
  "Direct Email": "employer_contact",
  "Phone Call": "employer_contact",
  LinkedIn: "networking",
  "Networking Event": "networking",
  Interview: "employer_contact",
  "In-Person Meeting": "employer_contact",
  "Video Meeting": "employer_contact",
  "Recruiter / Headhunter Screen": "employer_contact",
  "Networking Contact": "networking",
  "Career-Center Advisor Meeting": "networking",
};

function deriveTier(method: string): ActivityTier {
  return TIER_BY_METHOD[method] ?? "employer_contact";
}

function tierOf(ws: WorkSearch): ActivityTier {
  if (ws.activity_tier === "employer_contact" || ws.activity_tier === "networking") {
    return ws.activity_tier;
  }
  return deriveTier(ws.contact_method);
}

// Helper notes shown under specific Contact Method options.
const METHOD_NOTES: Record<string, string> = {
  LinkedIn:
    "Only active outreach / connecting counts. Browsing or saving job ads is NOT a qualifying activity — the DOL discounts it.",
  "In-Person Meeting":
    "Record the physical office or venue address below so an auditor never has to ask who this is or why you met.",
  "Video Meeting": "Teams/Zoom. You may paste the meeting link in the address field (fine if dead later).",
  "Recruiter / Headhunter Screen":
    "Tier A — the recruiter stands in for the employer. Put the recruiter's name & title in Person Contacted and the represented employer (or “client — to be clarified”) in Company.",
  "Networking Contact":
    "Tier B — a person who does NOT work at the end employer (industry/former colleague, vendor, client).",
  "Career-Center Advisor Meeting":
    "The mandated DOL advisor meeting itself counts as one of your three weekly activities.",
};

// Tier-B activity types to substitute on a short week (Gap 7 guidance) — so a
// week is never padded with junk applications to ill-fitting roles.
const TIER_B_SUGGESTIONS = [
  "Active LinkedIn outreach — connect or message a real person (not ad browsing)",
  "Coffee or call with a former colleague or industry peer",
  "Attend a networking event or industry meetup",
  "Reach out to a vendor or client contact",
  "Your mandated Career-Center advisor meeting",
];

// Read-only prevailing-wage reference (Gap 7). Display only — no logic.
const WAGE_REFERENCE = {
  targetBase: "$300,000",
  benchmarkAnnual: "$293,769",
  benchmarkHourly: "$141.23 / hr",
  thresholdAnnual: "$264,388",
  thresholdHourly: "$127.11 / hr",
};

// One-click preset for the mandated advisor meeting (Gap 2).
const ADVISOR_PRESET = {
  company_name: "NYS DOL Career Center",
  company_location: "NYS Department of Labor — Career Center",
  contact_method: "Career-Center Advisor Meeting",
  activity_tier: "networking" as ActivityTier,
  contact_person: "",
  position_applied: "N/A — mandated work-search advisor review",
  result: "Pending",
  outcome_next_step: "Completed mandated DOL work-search review with advisor.",
  next_contact_date: "",
};

// Prefill payload passed from the dashboard "add follow-up" action (Gap 4) and
// the "edit" action (which also carries the date so the whole row loads).
type WorkSearchPrefill = {
  date?: string;
  company_name?: string;
  company_location?: string;
  contact_method?: string;
  activity_tier?: ActivityTier;
  contact_person?: string;
  position_applied?: string;
  result?: string;
  outcome_next_step?: string;
  next_contact_date?: string;
  parent_activity_id?: string | null;
  /** When set, this work search came from a customized resume; logging it
   *  marks that customization as logged so it leaves the "to log" queue. */
  customizationId?: string | null;
};

const WEEKLY_LIMIT = 10 * 60;
const WARN_THRESHOLD = 8 * 60;
const DAILY_LIMIT = 10 * 60;

// ─── Utilities ────────────────────────────────────────────────────────────────

function entryMins(e: BusinessHour) {
  return e.hours * 60 + e.minutes;
}

function shortEntity(entity: string) {
  if (entity.includes("Ventures")) return "Ventures";
  if (entity.includes("Advisors")) return "Advisors";
  return entity;
}

function hoursFingerprint(e: {
  entity: string;
  activity_category: string | null | undefined;
  activity_description: string;
  hours: number;
  minutes: number;
}) {
  return `${e.entity}|${e.activity_category ?? ""}|${e.activity_description}|${e.hours}|${e.minutes}`;
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

// HTML-escape for the printable ledger.
function escHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Claim-week bounds for a given date. Uses the SAME Sunday-start boundary as
// the dashboard so grouping stays consistent.
function weekRangeOf(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T12:00:00");
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const fmt = (x: Date) => x.toISOString().split("T")[0];
  return { start: fmt(sunday), end: fmt(saturday) };
}

function fmtLong(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Minutes logged per known business entity (Ventures / Advisors). */
function entityMinutes(entries: BusinessHour[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const entity of ENTITIES) totals[entity] = 0;
  for (const e of entries) {
    totals[e.entity] = (totals[e.entity] ?? 0) + entryMins(e);
  }
  return totals;
}

function summarizeEntityHours(entries: BusinessHour[]): string[] {
  const totals = entityMinutes(entries);
  const lines: string[] = [];
  for (const entity of ENTITIES) {
    const mins = totals[entity] ?? 0;
    if (mins > 0) lines.push(`${entity}: ${fmtHm(mins)}`);
  }
  const combined = entries.reduce((s, e) => s + entryMins(e), 0);
  if (combined > 0) lines.push(`Combined total: ${fmtHm(combined)}`);
  return lines;
}

// Build the audit-ready, per-claim-week ledger (Gap 5) as a standalone
// printable HTML document. Tier A (Employer Contacts), Tier B (Networking),
// then Business Hours (Kuperman Ventures / Kuperman Advisors) when logged.
// Stamped with the Work Search ID (never the SSN).
function buildLedgerHtml(
  workSearches: WorkSearch[],
  businessHours: BusinessHour[],
  startDate: string,
  endDate: string,
  workSearchId: string | null
): string {
  // Group by Sunday-start claim week. Include weeks that have either
  // work-search activity or business-hours entries.
  const weeks = new Map<string, { workSearches: WorkSearch[]; businessHours: BusinessHour[] }>();
  const ensureWeek = (key: string) => {
    let bucket = weeks.get(key);
    if (!bucket) {
      bucket = { workSearches: [], businessHours: [] };
      weeks.set(key, bucket);
    }
    return bucket;
  };
  for (const ws of workSearches) {
    ensureWeek(weekRangeOf(ws.date).start).workSearches.push(ws);
  }
  for (const bh of businessHours) {
    ensureWeek(weekRangeOf(bh.date).start).businessHours.push(bh);
  }
  const weekKeys = [...weeks.keys()].sort();

  const rowHtml = (ws: WorkSearch) => {
    const contact = ws.contact_person ? escHtml(ws.contact_person) : "—";
    const where = escHtml(ws.company_location || "number withheld");
    const next = [
      ws.outcome_next_step ? escHtml(ws.outcome_next_step) : "",
      ws.next_contact_date ? `(next: ${escHtml(ws.next_contact_date)})` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<tr>
      <td>${escHtml(ws.date)}</td>
      <td>${escHtml(ws.company_name)}</td>
      <td>${contact}</td>
      <td>${escHtml(ws.position_applied)}</td>
      <td>${escHtml(ws.contact_method)}</td>
      <td>${where}</td>
      <td>${escHtml(ws.result)}${next ? ` — ${next}` : ""}</td>
    </tr>`;
  };

  const sectionHtml = (title: string, rows: WorkSearch[]) => `
    <h3 class="tier">${escHtml(title)} <span class="count">(${rows.length})</span></h3>
    ${
      rows.length === 0
        ? `<p class="empty">No activities in this section.</p>`
        : `<table>
            <thead><tr>
              <th>Date</th><th>Company / Org</th><th>Contact + Title</th>
              <th>Position</th><th>Method</th><th>Address / URL / Phone</th>
              <th>Result · Outcome / Next Step</th>
            </tr></thead>
            <tbody>${rows.map(rowHtml).join("")}</tbody>
          </table>`
    }`;

  const businessHoursHtml = (entries: BusinessHour[]) => {
    if (entries.length === 0) {
      return `<h3 class="tier">Business Hours</h3><p class="empty">No business hours logged this week.</p>`;
    }
    const sorted = entries.slice().sort((a, b) => a.date.localeCompare(b.date));
    const totals = entityMinutes(sorted);
    const summaryRows = ENTITIES.map((entity) => {
      const mins = totals[entity] ?? 0;
      return `<tr><td>${escHtml(entity)}</td><td>${escHtml(fmtHm(mins))}</td></tr>`;
    }).join("");
    const combined = sorted.reduce((s, e) => s + entryMins(e), 0);
    const detailRows = sorted
      .map(
        (e) => `<tr>
          <td>${escHtml(e.date)}</td>
          <td>${escHtml(e.entity)}</td>
          <td>${escHtml(e.activity_category || "—")}</td>
          <td>${escHtml(e.activity_description)}</td>
          <td>${escHtml(fmtHm(entryMins(e)))}</td>
        </tr>`
      )
      .join("");
    return `
      <h3 class="tier">Business Hours <span class="count">(${sorted.length} entr${sorted.length === 1 ? "y" : "ies"} · ${escHtml(fmtHm(combined))})</span></h3>
      <table>
        <thead><tr><th>Entity</th><th>Hours This Week</th></tr></thead>
        <tbody>
          ${summaryRows}
          <tr><td><strong>Combined Total</strong></td><td><strong>${escHtml(fmtHm(combined))}</strong></td></tr>
        </tbody>
      </table>
      <table>
        <thead><tr>
          <th>Date</th><th>Entity</th><th>Category</th><th>Note / Description</th><th>Duration</th>
        </tr></thead>
        <tbody>${detailRows}</tbody>
      </table>`;
  };

  const rangeTotals = summarizeEntityHours(businessHours);
  const rangeSummaryHtml =
    rangeTotals.length > 0
      ? `<p class="meta"><strong>Business Hours (range):</strong> ${escHtml(rangeTotals.join(" · "))}</p>`
      : `<p class="meta"><strong>Business Hours (range):</strong> none logged</p>`;

  const weeksHtml = weekKeys
    .map((key) => {
      const { start, end } = weekRangeOf(key);
      const bucket = weeks.get(key)!;
      const inWeek = bucket.workSearches.slice().sort((a, b) => a.date.localeCompare(b.date));
      const bhWeek = bucket.businessHours;
      const tierA = inWeek.filter((w) => tierOf(w) === "employer_contact");
      const tierB = inWeek.filter((w) => tierOf(w) === "networking");
      const bhMins = bhWeek.reduce((s, e) => s + entryMins(e), 0);
      const activityLabel = `${inWeek.length} activit${inWeek.length === 1 ? "y" : "ies"}`;
      const hoursLabel = bhMins > 0 ? ` · ${fmtHm(bhMins)} business hours` : "";
      return `<section class="week">
        <h2>Claim Week: ${escHtml(fmtLong(start))} – ${escHtml(fmtLong(end))}
          <span class="count">· ${escHtml(activityLabel)}${escHtml(hoursLabel)}</span>
        </h2>
        ${sectionHtml("Tier A — Employer Contacts", tierA)}
        ${sectionHtml("Tier B — Networking / Fruitful Activities", tierB)}
        ${businessHoursHtml(bhWeek)}
      </section>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" />
    <title>NYS DOL Work Search Ledger</title>
    <style>
      *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;margin:32px;font-size:12px}
      h1{font-size:18px;margin:0 0 4px} .meta{color:#444;font-size:12px;margin:0 0 2px}
      .week{margin-top:24px;page-break-inside:avoid} .week>h2{font-size:14px;border-bottom:2px solid #111;padding-bottom:4px}
      h3.tier{font-size:12px;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.04em;color:#222}
      .count{color:#666;font-weight:400}
      table{width:100%;border-collapse:collapse;margin-bottom:8px} th,td{border:1px solid #bbb;padding:5px 7px;text-align:left;vertical-align:top}
      th{background:#f1f1f1;font-size:10px;text-transform:uppercase;letter-spacing:.03em}
      .empty{color:#888;font-style:italic;margin:2px 0 8px}
      .foot{margin-top:28px;color:#888;font-size:10px;border-top:1px solid #ddd;padding-top:8px}
      @media print{body{margin:12mm}}
    </style></head><body>
    <h1>NYS DOL — Work Search Proof-of-Effort Ledger</h1>
    <p class="meta"><strong>Work Search ID:</strong> ${escHtml(workSearchId || "—— set NYUI_WORK_SEARCH_ID to stamp ——")}</p>
    <p class="meta"><strong>Range:</strong> ${escHtml(fmtLong(startDate))} – ${escHtml(fmtLong(endDate))}</p>
    <p class="meta"><strong>Generated:</strong> ${escHtml(new Date().toLocaleString())}</p>
    ${rangeSummaryHtml}
    ${weeksHtml || `<p class="empty">No work-search or business-hours activity in this range.</p>`}
    <p class="foot">Claim weeks shown Sunday–Saturday. Business hours shown when logged against Kuperman Ventures LLC or Kuperman Advisors LLC. SSN intentionally omitted; identity is matched by Work Search ID only.</p>
    </body></html>`;
}

function writeLedgerToWindow(
  win: Window,
  workSearches: WorkSearch[],
  businessHours: BusinessHour[],
  startDate: string,
  endDate: string,
  workSearchId: string | null
) {
  const html = buildLedgerHtml(
    workSearches,
    businessHours,
    startDate,
    endDate,
    workSearchId
  );
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Give the new document a tick to lay out before invoking print.
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // Print may be blocked; the page is still open for Save as PDF.
    }
  }, 350);
}

/** Fallback when the blank window was closed/blocked after the async fetch. */
function openPrintableLedger(
  workSearches: WorkSearch[],
  businessHours: BusinessHour[],
  startDate: string,
  endDate: string,
  workSearchId: string | null
) {
  const html = buildLedgerHtml(
    workSearches,
    businessHours,
    startDate,
    endDate,
    workSearchId
  );
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    // Last resort: trigger a download the user can open locally.
    const a = document.createElement("a");
    a.href = url;
    a.download = `nys-dol-ledger-${startDate}-to-${endDate}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return "downloaded" as const;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      // Page still usable for Save as PDF.
    }
  }, 350);
  return "opened" as const;
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

function ExportModal({
  onClose,
  defaultStart = "",
  defaultEnd = "",
}: {
  onClose: () => void;
  defaultStart?: string;
  defaultEnd?: string;
}) {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
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
        { key: "tier_label", label: "Tier" },
        { key: "company_name", label: "Company / Organization" },
        { key: "company_location", label: "Location / URL" },
        { key: "contact_method", label: "Contact Method" },
        { key: "contact_person", label: "Contact Person" },
        { key: "position_applied", label: "Position Applied For" },
        { key: "result", label: "Result" },
        { key: "outcome_next_step", label: "Outcome / Next Step" },
        { key: "next_contact_date", label: "Next Contact Date" },
        { key: "created_at", label: "Date Logged" },
      ];
      const bhCols = [
        { key: "date", label: "Date" },
        { key: "entity", label: "Entity" },
        { key: "activity_category", label: "Category" },
        { key: "activity_description", label: "Note / Description" },
        { key: "hours", label: "Hours" },
        { key: "minutes", label: "Minutes" },
        { key: "created_at", label: "Date Logged" },
      ];

      const ws = result.workSearches.map((w) => ({
        ...w,
        tier_label: TIER_SHORT[tierOf(w)],
      })) as unknown as Record<string, unknown>[];
      const bhEntries = result.businessHours;
      const bh = bhEntries as unknown as Record<string, unknown>[];
      const workSearchIdLine = result.workSearchId
        ? `"Work Search ID: ${result.workSearchId}"`
        : `"Work Search ID: (set NYUI_WORK_SEARCH_ID env to stamp)"`;
      const entityTotals = entityMinutes(bhEntries);
      const entitySummaryRows = ENTITIES.map((entity) => ({
        entity,
        hours_display: fmtHm(entityTotals[entity] ?? 0),
        total_minutes: entityTotals[entity] ?? 0,
      }));
      const combinedMins = bhEntries.reduce((s, e) => s + entryMins(e), 0);
      entitySummaryRows.push({
        entity: "Combined Total",
        hours_display: fmtHm(combinedMins),
        total_minutes: combinedMins,
      });
      const entitySummaryCols = [
        { key: "entity", label: "Entity" },
        { key: "hours_display", label: "Hours in Range" },
        { key: "total_minutes", label: "Total Minutes" },
      ];

      // Per claim-week entity totals (only weeks that have business hours).
      const bhByWeek = new Map<string, BusinessHour[]>();
      for (const e of bhEntries) {
        const key = weekRangeOf(e.date).start;
        const list = bhByWeek.get(key);
        if (list) list.push(e);
        else bhByWeek.set(key, [e]);
      }
      const weeklySummaryRows: Record<string, unknown>[] = [];
      for (const key of [...bhByWeek.keys()].sort()) {
        const { start, end } = weekRangeOf(key);
        const weekEntries = bhByWeek.get(key)!;
        const weekTotals = entityMinutes(weekEntries);
        const weekCombined = weekEntries.reduce((s, e) => s + entryMins(e), 0);
        weeklySummaryRows.push({
          week: `${start} to ${end}`,
          ventures: fmtHm(weekTotals["Kuperman Ventures LLC"] ?? 0),
          advisors: fmtHm(weekTotals["Kuperman Advisors LLC"] ?? 0),
          combined: fmtHm(weekCombined),
        });
      }
      const weeklySummaryCols = [
        { key: "week", label: "Claim Week (Sun–Sat)" },
        { key: "ventures", label: "Kuperman Ventures LLC" },
        { key: "advisors", label: "Kuperman Advisors LLC" },
        { key: "combined", label: "Combined" },
      ];

      // UTF-8 BOM helps Excel open the multi-section CSV with correct encoding.
      const report =
        "\uFEFF" +
        [
          `"NYS DOL COMPLIANCE AUDIT REPORT"`,
          `"Date Range: ${startDate} to ${endDate}"`,
          workSearchIdLine,
          `"Generated: ${new Date().toLocaleString()}"`,
          "",
          "",
          `"=== SECTION 1: WORK SEARCH LOG (${ws.length} records) ==="`,
          buildCSV(wsCols, ws),
          "",
          "",
          `"=== SECTION 2: BUSINESS HOURS BY ENTITY ==="`,
          buildCSV(entitySummaryCols, entitySummaryRows),
          "",
          "",
          `"=== SECTION 3: BUSINESS HOURS BY CLAIM WEEK ==="`,
          weeklySummaryRows.length > 0
            ? buildCSV(weeklySummaryCols, weeklySummaryRows)
            : `"No business hours logged in this range."`,
          "",
          "",
          `"=== SECTION 4: BUSINESS HOURS DETAIL LOG (${bh.length} records) ==="`,
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
      if (recoverFromStaleServerAction(err)) return;
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLedger() {
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
    // Open the tab in the same user-gesture turn. Waiting on the server
    // action first lets browsers treat window.open as a blocked pop-up.
    const placeholder = window.open("", "_blank");
    if (placeholder) {
      try {
        placeholder.document.write(
          "<!doctype html><title>Preparing ledger…</title><body style=\"font-family:sans-serif;padding:24px;color:#444\">Preparing printable ledger…</body>"
        );
      } catch {
        // Cross-origin timing quirks — ignore; we'll rewrite below.
      }
    }
    try {
      const result = await getExportData(startDate, endDate);
      if (result.error) throw new Error(result.error);
      if (placeholder && !placeholder.closed) {
        writeLedgerToWindow(
          placeholder,
          result.workSearches,
          result.businessHours,
          startDate,
          endDate,
          result.workSearchId
        );
      } else {
        const mode = openPrintableLedger(
          result.workSearches,
          result.businessHours,
          startDate,
          endDate,
          result.workSearchId
        );
        if (mode === "downloaded") {
          setError(
            "Pop-up blocked — downloaded an HTML ledger file instead. Open it and use Save as PDF."
          );
          return;
        }
      }
      onClose();
    } catch (err) {
      if (placeholder && !placeholder.closed) placeholder.close();
      if (recoverFromStaleServerAction(err)) return;
      setError(err instanceof Error ? err.message : "Ledger generation failed");
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
              Dates default to this claim week. Includes work searches plus Kuperman
              Ventures / Advisors hours when logged.
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
          <div className="space-y-2 pt-1">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleExport}
                disabled={loading || !startDate || !endDate}
                className="flex-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FileDown className="h-4 w-4" />
                {loading ? "Generating…" : "Download CSV"}
              </button>
              <button
                type="button"
                onClick={handleLedger}
                disabled={loading || !startDate || !endDate}
                className="flex-1 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" />
                {loading ? "Generating…" : "Printable Ledger"}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
            >
              Cancel
            </button>
            <p className="text-[11px] text-muted-foreground pt-0.5">
              The printable ledger groups by claim week with Tier A (Employer Contacts), Tier B
              (Networking), and Business Hours (Kuperman Ventures / Advisors) when present,
              stamped with your Work Search ID. Use your browser&apos;s &ldquo;Save as PDF&rdquo;
              for a one-week audit.
            </p>
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
  onFollowUp,
  applicationQueue,
  onLogApplication,
  onDismissApplication,
}: {
  workSearches: WorkSearch[];
  businessHours: BusinessHour[];
  weekStart: string;
  weekEnd: string;
  onNavigate: (screen: SubScreen) => void;
  onFollowUp: (ws: WorkSearch) => void;
  applicationQueue: ResumeApplication[];
  onLogApplication: (app: ResumeApplication) => void;
  onDismissApplication: (customizationId: string) => void;
}) {
  const [showExport, setShowExport] = useState(false);
  // The item currently auto-finding its URL before opening the prefilled form.
  const [findingId, setFindingId] = useState<string | null>(null);

  // Clicking "Add as work search" auto-searches for the posting URL (when we
  // don't already have one), then opens the log form prefilled with company,
  // role, AND the URL — just like the other fields.
  async function handleAddApplication(app: ResumeApplication) {
    if (app.url) {
      onLogApplication(app);
      return;
    }
    setFindingId(app.customizationId);
    const res = await findCompanyUrl({ company: app.company ?? "" });
    setFindingId(null);
    onLogApplication({ ...app, url: res.ok ? res.url : null });
  }

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

  // Two-tier breakdown (Gap 1).
  const tierACount = workSearches.filter((w) => tierOf(w) === "employer_contact").length;
  const tierBCount = workSearches.filter((w) => tierOf(w) === "networking").length;

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

      {/* From your customized resumes — each tailored resume is a job app */}
      {applicationQueue.length > 0 && (
        <details className="group rounded-xl border border-border bg-card p-6 shadow-sm">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">
                From your customized resumes
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Each tailored resume is a job application. Log it as a work
                search — company, URL, and role are pre-filled; you complete the
                rest.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge
                variant={applicationQueue.length >= 3 ? "success" : "neutral"}
              >
                {applicationQueue.length} to log
              </StatusBadge>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </div>
          </summary>
          <div className="mt-4 divide-y divide-border rounded-lg border border-border overflow-hidden">
            {applicationQueue.map((app) => {
              const finding = findingId === app.customizationId;
              return (
                <div
                  key={app.customizationId}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">
                      {app.company ?? "Company"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {app.roleTitle ?? "Role from the job description"}
                      {app.url ? ` · ${app.url}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddApplication(app)}
                    disabled={finding}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 disabled:opacity-60"
                    title="Finds the posting URL, then opens the prefilled work-search form"
                  >
                    {finding ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Finding URL…
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> Add as work search
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissApplication(app.customizationId)}
                    disabled={finding}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    aria-label="Remove from list"
                    title="Remove from list (don't log)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </details>
      )}

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

        {/* Two-tier breakdown (Gap 1) */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Tier A — Employer Contacts
            </p>
            <p className="text-lg font-bold tabular-nums text-foreground">{tierACount}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Tier B — Networking / Fruitful
            </p>
            <p className="text-lg font-bold tabular-nums text-foreground">{tierBCount}</p>
          </div>
        </div>

        {workSearches.length > 0 && uniqueDays < workSearches.length && (
          <p className="mt-3 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
            {workSearches.length - uniqueDays} activit
            {workSearches.length - uniqueDays !== 1 ? "ies" : "y"} logged on a day already counted
            — only unique days count toward the 3-day goal.
          </p>
        )}

        {/* Short-week guidance (Gap 7) — substitutable Tier-B activities */}
        {workSearches.length < 3 && (
          <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <p className="text-xs font-medium text-foreground">
              Short on activities this week? Don&apos;t pad with junk applications to roles that
              don&apos;t fit. These Tier-B activities also count:
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {TIER_B_SUGGESTIONS.map((s) => (
                <li key={s} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-muted-foreground/50">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-medium text-foreground leading-snug">
                          {ws.company_name}
                        </p>
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {TIER_SHORT[tierOf(ws)]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ws.position_applied} · {ws.contact_method}
                      </p>
                      {ws.outcome_next_step && (
                        <p className="text-xs text-muted-foreground/80 mt-0.5">
                          ↳ {ws.outcome_next_step}
                          {ws.next_contact_date ? ` (next: ${fmtDate(ws.next_contact_date)})` : ""}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => onFollowUp(ws)}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-foreground/70 hover:text-foreground underline underline-offset-2"
                      >
                        <Plus className="h-3 w-3" /> Add follow-up
                      </button>
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
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        {entry.entity}
                      </p>
                      {entry.activity_category && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {entry.activity_category}
                        </span>
                      )}
                    </div>
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

      {/* Prevailing-wage reference (Gap 7) — read-only, no logic */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <h3 className="font-semibold text-foreground">Prevailing-Wage Reference</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              For reference only — the line at which a rejected offer could be questioned.
            </p>
          </div>
          <StatusBadge variant="neutral">Read-only</StatusBadge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Target Base
            </p>
            <p className="font-bold tabular-nums text-foreground">{WAGE_REFERENCE.targetBase}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              DOL Chief-Executive Benchmark
            </p>
            <p className="font-bold tabular-nums text-foreground">
              {WAGE_REFERENCE.benchmarkAnnual}
            </p>
            <p className="text-[11px] text-muted-foreground">{WAGE_REFERENCE.benchmarkHourly}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              90% Threshold
            </p>
            <p className="font-bold tabular-nums text-foreground">
              {WAGE_REFERENCE.thresholdAnnual}
            </p>
            <p className="text-[11px] text-muted-foreground">{WAGE_REFERENCE.thresholdHourly}</p>
          </div>
        </div>
      </div>

      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          defaultStart={weekStart}
          defaultEnd={weekEnd}
        />
      )}
    </div>
  );
}

// ─── Work Search Form ─────────────────────────────────────────────────────────

function WorkSearchForm({
  onSuccess,
  onBack,
  prefill,
  editId,
}: {
  onSuccess: () => void;
  onBack: () => void;
  prefill?: WorkSearchPrefill | null;
  editId?: string | null;
}) {
  const isEdit = Boolean(editId);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    date: prefill?.date ?? todayStr(),
    company_name: prefill?.company_name ?? "",
    company_location: prefill?.company_location ?? "",
    contact_method: prefill?.contact_method ?? "",
    activity_tier: prefill?.activity_tier ?? "",
    contact_person: prefill?.contact_person ?? "",
    position_applied: prefill?.position_applied ?? "",
    result: prefill?.result ?? "",
    outcome_next_step: prefill?.outcome_next_step ?? "",
    next_contact_date: prefill?.next_contact_date ?? "",
  });
  const [parentActivityId] = useState<string | null>(prefill?.parent_activity_id ?? null);
  const [customizationId] = useState<string | null>(prefill?.customizationId ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set(field: string) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  // Contact method drives the default tier; the user can still override the
  // tier select afterward (a Phone Call can be Tier A or Tier B).
  function setMethod(e: React.ChangeEvent<HTMLSelectElement>) {
    const method = e.target.value;
    setForm((f) => ({
      ...f,
      contact_method: method,
      activity_tier: method ? deriveTier(method) : f.activity_tier,
    }));
  }

  function applyAdvisorPreset() {
    setForm((f) => ({
      ...f,
      company_name: ADVISOR_PRESET.company_name,
      company_location: ADVISOR_PRESET.company_location,
      contact_method: ADVISOR_PRESET.contact_method,
      activity_tier: ADVISOR_PRESET.activity_tier,
      contact_person: ADVISOR_PRESET.contact_person,
      position_applied: ADVISOR_PRESET.position_applied,
      result: ADVISOR_PRESET.result,
      outcome_next_step: ADVISOR_PRESET.outcome_next_step,
      next_contact_date: ADVISOR_PRESET.next_contact_date,
    }));
    setErrors({});
  }

  const isInPerson = form.contact_method === "In-Person Meeting";

  function validate() {
    const e: Record<string, string> = {};
    if (!form.date) e.date = "Required";
    if (!form.company_name.trim()) e.company_name = "Required";
    if (!form.company_location.trim()) {
      e.company_location = isInPerson ? "Physical address required for an in-person meeting" : "Required";
    }
    if (!form.contact_method) e.contact_method = "Required";
    if (!form.activity_tier) e.activity_tier = "Required";
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
      try {
        const payload = {
          date: form.date,
          company_name: form.company_name.trim(),
          company_location: form.company_location.trim(),
          contact_method: form.contact_method,
          contact_person: form.contact_person.trim() || null,
          position_applied: form.position_applied.trim(),
          result: form.result,
          activity_tier: form.activity_tier || deriveTier(form.contact_method),
          outcome_next_step: form.outcome_next_step.trim() || null,
          next_contact_date: form.next_contact_date || null,
        };
        const result =
          isEdit && editId
            ? await updateWorkSearch({ id: editId, ...payload })
            : await addWorkSearch({ ...payload, parent_activity_id: parentActivityId });
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        // If this came from a customized resume, drop it from the "to log" queue.
        if (!isEdit && customizationId) {
          await markResumeApplicationLogged(customizationId);
        }
        setDone(true);
        router.refresh();
        setTimeout(onSuccess, 1000);
      } catch (err) {
        if (recoverFromStaleServerAction(err)) return;
        setServerError(err instanceof Error ? err.message : "Save failed");
      }
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
          ← Back
        </button>
        <h2 className="text-lg font-bold text-foreground">
          {isEdit ? "Edit Work Search Activity" : "Log Work Search Activity"}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isEdit
            ? "Update this logged activity. Changes save to the existing entry."
            : "Record each contact or application attempt for NYS DOL compliance."}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {done ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-foreground">
              {isEdit ? "Changes saved" : "Activity logged successfully"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Returning to dashboard…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {isEdit && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                Editing a previously logged activity. Saving updates this entry in place.
              </div>
            )}
            {!isEdit && parentActivityId && (
              <div className="rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-200">
                Adding a follow-up stage to an existing opportunity — employer details are
                pre-filled. This still counts as its own activity toward the weekly requirement.
              </div>
            )}

            {!parentActivityId && !isEdit && (
              <button
                type="button"
                onClick={applyAdvisorPreset}
                className="w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Quick-log: Career-Center Advisor Meeting
              </button>
            )}

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
              <select className={selectCls} value={form.contact_method} onChange={setMethod}>
                <option value="">Select contact method…</option>
                {CONTACT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {METHOD_NOTES[form.contact_method] && (
                <p className="text-xs text-muted-foreground mt-1.5 flex gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {METHOD_NOTES[form.contact_method]}
                </p>
              )}
            </Field>

            <Field
              label="Activity Tier"
              required
              hint="auto-set from method; override if needed"
              error={errors.activity_tier}
            >
              <select className={selectCls} value={form.activity_tier} onChange={set("activity_tier")}>
                <option value="">Select tier…</option>
                <option value="employer_contact">{TIER_LABELS.employer_contact}</option>
                <option value="networking">{TIER_LABELS.networking}</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">
                Tier A = direct contact with an employer or someone representing one (a recruiter
                screening for a specific employer counts). Tier B = networking that advances the
                search (the contact does not work at the end employer).
              </p>
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

            <Field
              label="Outcome / Next Step"
              hint="optional"
            >
              <textarea
                className={inputCls + " min-h-[70px] resize-y"}
                placeholder="e.g., Phone screen Jun 11 · Next round projected Jul 1 · Speak again in two weeks"
                value={form.outcome_next_step}
                onChange={set("outcome_next_step")}
              />
            </Field>

            <Field label="Next Contact Date" hint="optional">
              <input
                type="date"
                className={inputCls}
                value={form.next_contact_date}
                onChange={set("next_contact_date")}
              />
            </Field>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md bg-foreground py-2.5 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
            >
              {isPending
                ? "Submitting…"
                : isEdit
                ? "Save Changes"
                : "Log Work Search Activity"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Business Hours Form ──────────────────────────────────────────────────────

function BusinessHoursForm({
  onContinueAfterSave,
  onDone,
  onBack,
  prefill,
  editId,
  existingHours = [],
}: {
  /** Stay on the form after a save so more activities can be added. */
  onContinueAfterSave: (ctx: { date: string; entity: string }) => void;
  /** Leave the form and return to All Activity. */
  onDone: () => void;
  onBack: () => void;
  prefill?: BusinessHoursPrefill | null;
  editId?: string | null;
  /** All saved business-hours rows — filtered in-form by the selected date. */
  existingHours?: BusinessHour[];
}) {
  const isEdit = Boolean(editId);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(prefill?.date ?? todayStr());
  const [entity, setEntity] = useState(prefill?.entity ?? "");
  // One activity at a time. After save, pick "+ Add another" or Done.
  const [row, setRow] = useState<BreakdownRow>(() =>
    newBreakdownRow({
      category: prefill?.activity_category ?? "",
      hours: prefill?.hours ?? "0",
      minutes: prefill?.minutes ?? "0",
      note: prefill?.activity_description ?? "",
    })
  );
  /** After a successful save, hide the entry fields until "+ Add another activity". */
  const [entryOpen, setEntryOpen] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  /** Just-saved rows shown immediately until router.refresh() catches up. */
  const [optimisticDay, setOptimisticDay] = useState<BusinessHour[]>([]);

  const serverForDay = existingHours.filter(
    (h) => h.date === date && (!editId || h.id !== editId)
  );
  const serverPrints = new Set(serverForDay.map(hoursFingerprint));
  const pendingOptimistic = optimisticDay.filter(
    (o) => o.date === date && !serverPrints.has(hoursFingerprint(o))
  );
  const dayBlocks = [...pendingOptimistic, ...serverForDay].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  const dayTotalMins = dayBlocks.reduce((sum, h) => sum + entryMins(h), 0);

  function rememberSaved(payloads: {
    date: string;
    entity: string;
    activity_category: string;
    activity_description: string;
    hours: number;
    minutes: number;
  }[]) {
    const now = Date.now();
    setOptimisticDay((prev) => [
      ...payloads.map((p, i) => ({
        id: `opt-${now}-${i}`,
        date: p.date,
        entity: p.entity,
        activity_category: p.activity_category,
        activity_description: p.activity_description,
        hours: p.hours,
        minutes: p.minutes,
        created_at: new Date(now + i).toISOString(),
      })),
      ...prev,
    ]);
  }

  const hours = parseInt(row.hours, 10) || 0;
  const minutes = parseInt(row.minutes, 10) || 0;
  const rowMins = hours * 60 + minutes;
  const rowReady = Boolean(row.category) && rowMins > 0;

  function updateRow(patch: Partial<BreakdownRow>) {
    setRow((prev) => ({ ...prev, ...patch }));
  }

  function setPreset(h: number, m: number) {
    updateRow({ hours: String(h), minutes: String(m) });
  }

  function openAnotherActivity() {
    setRow(newBreakdownRow());
    setErrors({});
    setServerError(null);
    setSaveNotice(null);
    setEntryOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!date) e.date = "Required";
    if (!entity) e.entity = "Required";

    const h = parseInt(row.hours, 10);
    const m = parseInt(row.minutes, 10);
    if (!row.category) e.category = "Pick a category";
    if (isNaN(h) || h < 0 || h > 24) e.hours = "0–24";
    if (isNaN(m) || m < 0 || m > 59) e.mins = "0–59";
    if (!isNaN(h) && !isNaN(m) && h === 0 && m === 0) {
      e.hours = "Time required";
    }
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

    const note = row.note.trim();
    const payload = {
      date,
      entity,
      activity_category: row.category,
      activity_description: note || row.category,
      hours: parseInt(row.hours, 10) || 0,
      minutes: parseInt(row.minutes, 10) || 0,
    };

    startTransition(async () => {
      try {
        if (isEdit && editId) {
          const result = await updateBusinessHours({ id: editId, ...payload });
          if (!result.ok) {
            setServerError(result.error);
            return;
          }
          rememberSaved([payload]);
          setSaveNotice(
            `Saved ${payload.activity_category} · ${fmtHm(payload.hours * 60 + payload.minutes)}. Add another or tap Done.`
          );
          setRow(newBreakdownRow());
          setEntryOpen(false);
          router.refresh();
          onContinueAfterSave({ date, entity });
          return;
        }

        const result = await addBusinessHoursBatch([payload]);
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        rememberSaved([payload]);
        setSaveNotice(
          `Logged ${payload.activity_category} · ${fmtHm(payload.hours * 60 + payload.minutes)}. Add another or tap Done.`
        );
        setRow(newBreakdownRow());
        setEntryOpen(false);
        router.refresh();
        onContinueAfterSave({ date, entity });
      } catch (err) {
        if (recoverFromStaleServerAction(err)) return;
        setServerError(err instanceof Error ? err.message : "Save failed");
      }
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
          ← Back
        </button>
        <h2 className="text-lg font-bold text-foreground">
          {isEdit ? "Edit Business Hours" : "Log Business Hours"}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isEdit
            ? "Update this entry, then add another activity or head back to All Activity."
            : "Log one activity at a time. After saving, add another or head back to All Activity. Combined weekly hours must stay under 10."}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {saveNotice && (
              <div className="rounded-md bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-400 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{saveNotice}</span>
              </div>
            )}
            {serverError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Date" required error={errors.date}>
                <input
                  type="date"
                  className={inputCls}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Entity" required error={errors.entity}>
                <select
                  className={selectCls}
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                >
                  <option value="">Select entity…</option>
                  {ENTITIES.map((ent) => (
                    <option key={ent} value={ent}>
                      {ent}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Activity</p>
                <p className="text-xs text-muted-foreground">
                  Pick the category and how long you spent. Saved blocks for this day show above.
                </p>
              </div>

              {dayBlocks.length > 0 ? (
                <div className="rounded-lg border border-border bg-background px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Already logged · {fmtDate(date)}
                    </p>
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      {fmtHm(dayTotalMins)}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {dayBlocks.map((block) => {
                      const note =
                        block.activity_description &&
                        block.activity_description !== block.activity_category
                          ? block.activity_description
                          : null;
                      return (
                        <li
                          key={block.id}
                          className="flex items-start justify-between gap-3 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium text-foreground truncate">
                                {block.activity_category || block.activity_description}
                              </span>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                {shortEntity(block.entity)}
                              </span>
                            </div>
                            {note && (
                              <p className="text-xs text-muted-foreground truncate">{note}</p>
                            )}
                          </div>
                          <span className="tabular-nums font-medium text-foreground shrink-0">
                            {fmtHm(entryMins(block))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Nothing logged yet for {fmtDate(date)}. New blocks will show up here.
                </div>
              )}

              {entryOpen && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                  <Field label="Category" required error={errors.category}>
                    <select
                      className={selectCls}
                      value={row.category}
                      onChange={(e) => updateRow({ category: e.target.value })}
                    >
                      <option value="">Select category…</option>
                      {ACTIVITY_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Time for this activity"
                    required
                    error={errors.hours || errors.mins}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {DURATION_PRESETS.map((p) => {
                          const active =
                            Number(row.hours) === p.hours &&
                            Number(row.minutes) === p.minutes;
                          return (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => setPreset(p.hours, p.minutes)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                active
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border bg-background text-foreground hover:bg-muted"
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="24"
                            className={inputCls + " w-20 text-center"}
                            value={row.hours}
                            onChange={(e) => updateRow({ hours: e.target.value })}
                          />
                          <span className="text-sm text-muted-foreground">hours</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            className={inputCls + " w-20 text-center"}
                            value={row.minutes}
                            onChange={(e) => updateRow({ minutes: e.target.value })}
                          />
                          <span className="text-sm text-muted-foreground">minutes</span>
                        </div>
                      </div>
                    </div>
                  </Field>

                  <Field label="Note" hint="optional" error={errors.note}>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="What you worked on (optional)"
                      value={row.note}
                      onChange={(e) => updateRow({ note: e.target.value })}
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {entryOpen ? (
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-md bg-foreground py-2.5 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                >
                  {isPending
                    ? isEdit
                      ? "Saving…"
                      : "Logging…"
                    : isEdit
                      ? "Save Changes"
                      : rowReady
                        ? `Log ${row.category} (${fmtHm(rowMins)})`
                        : "Log Business Hours"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openAnotherActivity}
                  disabled={isPending}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-foreground py-2.5 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add another activity
                </button>
              )}
              <button
                type="button"
                onClick={onDone}
                disabled={isPending}
                className="w-full rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-50"
              >
                Done — back to All Activity
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}

// ─── Root Client Component ────────────────────────────────────────────────────

// ─── All Activity (all-time history, grouped by claim week) ────────────────────

function resultVariant(
  result: string
): "success" | "warning" | "danger" | "neutral" {
  if (result === "Offer Received") return "success";
  if (result === "Interview Scheduled") return "warning";
  if (result === "Rejected") return "danger";
  return "neutral";
}

function AllActivity({
  workSearches,
  businessHours,
  currentWeekStart,
  onFollowUp,
  onEdit,
  onDelete,
  onEditHours,
  onDeleteHours,
  onAddToWeek,
  onAddHoursToWeek,
  deletingId,
  onNavigate,
}: {
  workSearches: WorkSearch[];
  businessHours: BusinessHour[];
  currentWeekStart: string;
  onFollowUp: (ws: WorkSearch) => void;
  onEdit: (ws: WorkSearch) => void;
  onDelete: (ws: WorkSearch) => void;
  onEditHours: (bh: BusinessHour) => void;
  onDeleteHours: (bh: BusinessHour) => void;
  onAddToWeek: (weekStart: string) => void;
  onAddHoursToWeek: (weekStart: string) => void;
  deletingId: string | null;
  onNavigate: (screen: SubScreen) => void;
}) {
  const [query, setQuery] = useState("");

  const totalWorkSearches = workSearches.length;
  const totalHoursEntries = businessHours.length;
  const totalActivities = totalWorkSearches + totalHoursEntries;

  // Case-insensitive filter across work searches + business hours.
  const q = query.trim().toLowerCase();
  const filteredWorkSearches = q
    ? workSearches.filter((ws) =>
        [
          ws.company_name,
          ws.company_location,
          ws.contact_method,
          ws.contact_person,
          ws.position_applied,
          ws.result,
          ws.outcome_next_step,
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q))
      )
    : workSearches;
  const filteredHours = q
    ? businessHours.filter((bh) =>
        [bh.entity, bh.activity_category, bh.activity_description]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q))
      )
    : businessHours;

  // Group into Sunday-start claim weeks (same boundary as dashboard / audit).
  // Weeks with only hours (no applications) still appear.
  type WeekBucket = { workSearches: WorkSearch[]; businessHours: BusinessHour[] };
  const weeks = new Map<string, WeekBucket>();
  const ensureWeek = (key: string) => {
    let bucket = weeks.get(key);
    if (!bucket) {
      bucket = { workSearches: [], businessHours: [] };
      weeks.set(key, bucket);
    }
    return bucket;
  };
  for (const ws of filteredWorkSearches) {
    ensureWeek(weekRangeOf(ws.date).start).workSearches.push(ws);
  }
  for (const bh of filteredHours) {
    ensureWeek(weekRangeOf(bh.date).start).businessHours.push(bh);
  }
  const weekKeys = [...weeks.keys()].sort((a, b) => (a < b ? 1 : -1));

  const matchCount = filteredWorkSearches.length + filteredHours.length;

  if (totalActivities === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-center py-12">
        <Clock className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No activity logged yet</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate("log-work-search")}
            className="text-xs text-foreground underline underline-offset-2"
          >
            Log work search →
          </button>
          <button
            type="button"
            onClick={() => onNavigate("log-business-hours")}
            className="text-xs text-foreground underline underline-offset-2"
          >
            Log business hours →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">All Activity</h2>
          <p className="text-sm text-muted-foreground">
            Work searches and business hours, broken out by claim week
          </p>
        </div>
        <StatusBadge variant="neutral">
          {q ? (
            <>
              {matchCount} of {totalActivities} shown
            </>
          ) : (
            <>
              {totalWorkSearches} app{totalWorkSearches !== 1 ? "s" : ""} ·{" "}
              {totalHoursEntries} hours entr
              {totalHoursEntries !== 1 ? "ies" : "y"} · {weekKeys.length} week
              {weekKeys.length !== 1 ? "s" : ""}
            </>
          )}
        </StatusBadge>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search activity…"
          className="h-9 pl-8"
          aria-label="Search activity"
        />
      </div>

      {matchCount === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-center py-12">
          <Search className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No activity matches &ldquo;{query.trim()}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-2 text-xs text-foreground underline underline-offset-2"
          >
            Clear search
          </button>
        </div>
      ) : null}

      {weekKeys.map((key) => {
        const bucket = weeks.get(key)!;
        const items = bucket.workSearches;
        const hours = bucket.businessHours;
        const { start, end } = weekRangeOf(key);
        const uniqueDays = new Set(items.map((w) => w.date)).size;
        const goalMet = uniqueDays >= 3;
        const tierA = items.filter((w) => tierOf(w) === "employer_contact").length;
        const tierB = items.filter((w) => tierOf(w) === "networking").length;
        const hoursMins = hours.reduce((s, e) => s + entryMins(e), 0);
        const isCurrent = start === currentWeekStart;

        const byDate = items.reduce<Record<string, WorkSearch[]>>((acc, ws) => {
          acc[ws.date] = acc[ws.date] ? [...acc[ws.date], ws] : [ws];
          return acc;
        }, {});
        const hoursByDate = hours
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));

        const startShort = new Date(start + "T12:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const endShort = new Date(end + "T12:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        return (
          <div key={key} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  Week of {startShort} – {endShort}
                  {isCurrent && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-foreground text-background">
                      This week
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {items.length} work search{items.length !== 1 ? "es" : ""} · Tier A {tierA} ·
                  Tier B {tierB}
                  {hoursMins > 0 ? ` · ${fmtHm(hoursMins)} business hours` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {items.length > 0 ? (
                  goalMet ? (
                    <StatusBadge variant="success">
                      <CheckCircle2 className="h-3 w-3" /> Goal Met
                    </StatusBadge>
                  ) : (
                    <StatusBadge variant={uniqueDays >= 2 ? "warning" : "neutral"}>
                      {uniqueDays} / 3 days
                    </StatusBadge>
                  )
                ) : (
                  <StatusBadge variant="neutral">Hours only</StatusBadge>
                )}
                <button
                  type="button"
                  onClick={() => onAddToWeek(start)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/80"
                >
                  <Plus className="h-3 w-3" /> Add application
                </button>
                <button
                  type="button"
                  onClick={() => onAddHoursToWeek(start)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/80"
                >
                  <Plus className="h-3 w-3" /> Add hours
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Work Searches ({items.length})
                </h4>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic px-1">
                    No work searches this week.
                  </p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                    {Object.keys(byDate)
                      .sort()
                      .map((date) =>
                        byDate[date].map((ws, i) => (
                          <div
                            key={ws.id}
                            className="grid grid-cols-[104px_1fr_auto] gap-3 px-3 py-2.5 text-sm items-start"
                          >
                            <span
                              className={`font-medium tabular-nums text-xs pt-0.5 ${
                                i > 0
                                  ? "text-muted-foreground/40"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {i === 0 ? fmtDate(date) : "↳ same day"}
                            </span>
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="font-medium text-foreground leading-snug">
                                  {ws.company_name}
                                </p>
                                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  {TIER_SHORT[tierOf(ws)]}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {ws.position_applied} · {ws.contact_method}
                              </p>
                              {ws.outcome_next_step && (
                                <p className="text-xs text-muted-foreground/80 mt-0.5">
                                  ↳ {ws.outcome_next_step}
                                  {ws.next_contact_date
                                    ? ` (next: ${fmtDate(ws.next_contact_date)})`
                                    : ""}
                                </p>
                              )}
                              <div className="mt-1 flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => onEdit(ws)}
                                  className="inline-flex items-center gap-1 text-[11px] text-foreground/70 hover:text-foreground underline underline-offset-2"
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onFollowUp(ws)}
                                  className="inline-flex items-center gap-1 text-[11px] text-foreground/70 hover:text-foreground underline underline-offset-2"
                                >
                                  <Plus className="h-3 w-3" /> Add follow-up
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDelete(ws)}
                                  disabled={deletingId === ws.id}
                                  className="inline-flex items-center gap-1 text-[11px] text-destructive/80 hover:text-destructive underline underline-offset-2 disabled:opacity-50"
                                >
                                  <Trash2 className="h-3 w-3" />{" "}
                                  {deletingId === ws.id ? "Deleting…" : "Delete"}
                                </button>
                              </div>
                            </div>
                            <StatusBadge variant={resultVariant(ws.result)}>
                              {ws.result}
                            </StatusBadge>
                          </div>
                        ))
                      )}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Business Hours ({hours.length}
                  {hoursMins > 0 ? ` · ${fmtHm(hoursMins)}` : ""})
                </h4>
                {hours.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic px-1">
                    No business hours this week.
                  </p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                    {hoursByDate.map((bh, i) => {
                      const prevDate = i > 0 ? hoursByDate[i - 1].date : null;
                      const sameDay = prevDate === bh.date;
                      return (
                        <div
                          key={bh.id}
                          className="grid grid-cols-[104px_1fr_auto] gap-3 px-3 py-2.5 text-sm items-start"
                        >
                          <span
                            className={`font-medium tabular-nums text-xs pt-0.5 ${
                              sameDay
                                ? "text-muted-foreground/40"
                                : "text-muted-foreground"
                            }`}
                          >
                            {sameDay ? "↳ same day" : fmtDate(bh.date)}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-medium text-foreground leading-snug">
                                {bh.entity}
                              </p>
                              {bh.activity_category && (
                                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  {bh.activity_category}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {bh.activity_description}
                            </p>
                            <div className="mt-1 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => onEditHours(bh)}
                                className="inline-flex items-center gap-1 text-[11px] text-foreground/70 hover:text-foreground underline underline-offset-2"
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteHours(bh)}
                                disabled={deletingId === bh.id}
                                className="inline-flex items-center gap-1 text-[11px] text-destructive/80 hover:text-destructive underline underline-offset-2 disabled:opacity-50"
                              >
                                <Trash2 className="h-3 w-3" />{" "}
                                {deletingId === bh.id ? "Deleting…" : "Delete"}
                              </button>
                            </div>
                          </div>
                          <StatusBadge variant="neutral">{fmtHm(entryMins(bh))}</StatusBadge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type SubScreen =
  | "dashboard"
  | "all-activity"
  | "log-work-search"
  | "log-business-hours";

const SUB_NAV: { id: SubScreen; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "all-activity", label: "All Activity" },
  { id: "log-work-search", label: "Log Work Search" },
  { id: "log-business-hours", label: "Log Business Hours" },
];

export function NyuiClient({
  initialData,
  weekStart,
  weekEnd,
  allWorkSearches,
  allBusinessHours = [],
  applicationQueue = [],
}: {
  initialData: NyuiWeekData;
  weekStart: string;
  weekEnd: string;
  allWorkSearches: WorkSearch[];
  allBusinessHours?: BusinessHour[];
  applicationQueue?: ResumeApplication[];
}) {
  const router = useRouter();
  const [subScreen, setSubScreen] = useState<SubScreen>("dashboard");
  const [wsPrefill, setWsPrefill] = useState<WorkSearchPrefill | null>(null);
  const [wsEditId, setWsEditId] = useState<string | null>(null);
  const [bhPrefill, setBhPrefill] = useState<BusinessHoursPrefill | null>(null);
  const [bhEditId, setBhEditId] = useState<string | null>(null);
  /** Remount Log Business Hours only when opening/leaving — not after Save — so the form stays put. */
  const [bhFormMountKey, setBhFormMountKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();

  // Tab navigation always starts a fresh (non-prefilled) form for that tab.
  function goToScreen(screen: SubScreen) {
    if (screen === "log-work-search") {
      setWsPrefill(null);
      setWsEditId(null);
    }
    if (screen === "log-business-hours") {
      setBhPrefill(null);
      setBhEditId(null);
      setBhFormMountKey((k) => k + 1);
    }
    setSubScreen(screen);
  }

  function resetWorkSearchForm() {
    setWsPrefill(null);
    setWsEditId(null);
    setSubScreen("all-activity");
  }

  function resetBusinessHoursForm() {
    setBhPrefill(null);
    setBhEditId(null);
    setBhFormMountKey((k) => k + 1);
    setSubScreen("all-activity");
  }

  /** After a save, clear edit mode but keep date/entity so more rows can be added. Does not remount. */
  function continueBusinessHoursAfterSave(ctx: { date: string; entity: string }) {
    setBhEditId(null);
    setBhPrefill({ date: ctx.date, entity: ctx.entity });
    setSubScreen("log-business-hours");
  }

  // "Add follow-up" (Gap 4): pre-fill employer details + link to the parent.
  function handleFollowUp(ws: WorkSearch) {
    setWsEditId(null);
    setWsPrefill({
      company_name: ws.company_name,
      company_location: ws.company_location,
      contact_method: ws.contact_method,
      activity_tier: tierOf(ws),
      contact_person: ws.contact_person ?? "",
      position_applied: ws.position_applied,
      parent_activity_id: ws.id,
    });
    setSubScreen("log-work-search");
  }

  // "Edit" from All Activity: load the whole row into the same form.
  function handleEdit(ws: WorkSearch) {
    setWsEditId(ws.id);
    setWsPrefill({
      date: ws.date,
      company_name: ws.company_name,
      company_location: ws.company_location,
      contact_method: ws.contact_method,
      activity_tier: tierOf(ws),
      contact_person: ws.contact_person ?? "",
      position_applied: ws.position_applied,
      result: ws.result,
      outcome_next_step: ws.outcome_next_step ?? "",
      next_contact_date: ws.next_contact_date ?? "",
    });
    setSubScreen("log-work-search");
  }

  function handleEditHours(bh: BusinessHour) {
    setBhEditId(bh.id);
    setBhPrefill({
      date: bh.date,
      entity: bh.entity,
      activity_category: bh.activity_category ?? "",
      // If the stored description was just the category name, leave note empty.
      activity_description:
        bh.activity_description && bh.activity_description !== bh.activity_category
          ? bh.activity_description
          : "",
      hours: String(bh.hours),
      minutes: String(bh.minutes),
    });
    setBhFormMountKey((k) => k + 1);
    setSubScreen("log-business-hours");
  }

  // "Log application" from a customized resume: prefill the work-search form
  // with company / URL / role and default it to an online-portal application.
  function handleLogApplication(app: ResumeApplication) {
    setWsEditId(null);
    setWsPrefill({
      company_name: app.company ?? "",
      company_location: app.url ?? "",
      contact_method: "Online Portal",
      activity_tier: "employer_contact",
      position_applied: app.roleTitle ?? "",
      result: "Application Submitted",
      customizationId: app.customizationId,
    });
    setSubScreen("log-work-search");
  }

  function handleDismissApplication(customizationId: string) {
    startDelete(async () => {
      await dismissResumeApplication(customizationId);
      router.refresh();
    });
  }

  // "Add application / hours to this week": pre-date into the claim week.
  function handleAddToWeek(weekStart: string) {
    setWsEditId(null);
    setWsPrefill({ date: weekStart });
    setSubScreen("log-work-search");
  }

  function handleAddHoursToWeek(weekStart: string) {
    setBhEditId(null);
    setBhPrefill({ date: weekStart });
    setBhFormMountKey((k) => k + 1);
    setSubScreen("log-business-hours");
  }

  function handleDelete(ws: WorkSearch) {
    const label = `${ws.company_name} — ${fmtDate(ws.date)}`;
    if (!window.confirm(`Delete this work-search entry?\n\n${label}\n\nThis can't be undone.`)) {
      return;
    }
    setDeletingId(ws.id);
    startDelete(async () => {
      try {
        const res = await deleteWorkSearch(ws.id);
        setDeletingId(null);
        if (!res.ok) {
          window.alert(`Could not delete: ${res.error}`);
          return;
        }
        router.refresh();
      } catch (err) {
        setDeletingId(null);
        if (recoverFromStaleServerAction(err)) return;
        window.alert(err instanceof Error ? err.message : "Could not delete");
      }
    });
  }

  function handleDeleteHours(bh: BusinessHour) {
    const label = `${bh.entity} — ${fmtDate(bh.date)} · ${fmtHm(entryMins(bh))}`;
    if (
      !window.confirm(
        `Delete this business-hours entry?\n\n${label}\n\n${bh.activity_description}\n\nThis can't be undone.`
      )
    ) {
      return;
    }
    setDeletingId(bh.id);
    startDelete(async () => {
      try {
        const res = await deleteBusinessHours(bh.id);
        setDeletingId(null);
        if (!res.ok) {
          window.alert(`Could not delete: ${res.error}`);
          return;
        }
        router.refresh();
      } catch (err) {
        setDeletingId(null);
        if (recoverFromStaleServerAction(err)) return;
        window.alert(err instanceof Error ? err.message : "Could not delete");
      }
    });
  }

  return (
    <section className="pb-4">
      <div className="flex gap-1 mb-6 border-b border-border">
        {SUB_NAV.map((item) => (
          <Fragment key={item.id}>
            {item.id === "log-business-hours" && (
              <a
                href="https://my.ny.gov/LoginV4/login.xhtml"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-t-md text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
                title="Open the NYS DOL / NY.gov site"
              >
                NYUI
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => goToScreen(item.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                subScreen === item.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </button>
          </Fragment>
        ))}
      </div>

      {subScreen === "dashboard" && (
        <NYUIDashboard
          workSearches={initialData.workSearches}
          businessHours={initialData.businessHours}
          weekStart={weekStart}
          weekEnd={weekEnd}
          onNavigate={goToScreen}
          onFollowUp={handleFollowUp}
          applicationQueue={applicationQueue}
          onLogApplication={handleLogApplication}
          onDismissApplication={handleDismissApplication}
        />
      )}
      {subScreen === "all-activity" && (
        <AllActivity
          workSearches={allWorkSearches}
          businessHours={allBusinessHours}
          currentWeekStart={weekStart}
          onFollowUp={handleFollowUp}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onEditHours={handleEditHours}
          onDeleteHours={handleDeleteHours}
          onAddToWeek={handleAddToWeek}
          onAddHoursToWeek={handleAddHoursToWeek}
          deletingId={deletingId}
          onNavigate={goToScreen}
        />
      )}
      {subScreen === "log-work-search" && (
        <WorkSearchForm
          key={wsEditId ?? "new-ws"}
          prefill={wsPrefill}
          editId={wsEditId}
          onSuccess={resetWorkSearchForm}
          onBack={resetWorkSearchForm}
        />
      )}
      {subScreen === "log-business-hours" && (
        <BusinessHoursForm
          key={bhFormMountKey}
          prefill={bhPrefill}
          editId={bhEditId}
          existingHours={allBusinessHours}
          onContinueAfterSave={continueBusinessHoursAfterSave}
          onDone={resetBusinessHoursForm}
          onBack={resetBusinessHoursForm}
        />
      )}
    </section>
  );
}
