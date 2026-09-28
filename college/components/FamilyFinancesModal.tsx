"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FinanceRecord } from "@/lib/finances";
import {
  EMPTY_FAMILY_DRAFT,
  PARENT_SITUATIONS,
  buildFamilyProfile,
  calcCore,
  formatRangeK,
  isTwoParentEarners,
  rangeAround,
  stepsForDraft,
  type FamilyFinanceDraft,
  type FamilyProfile,
  type FamilyStepId,
  type ParentSituation,
  type ProgramStatus,
} from "@/lib/familyFinances";

type SchoolInput = {
  id: string;
  name: string;
  finance: FinanceRecord | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (profile: FamilyProfile) => void;
  schools: SchoolInput[];
};

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatSaiDisplay(sai: number | null): string {
  if (sai == null) return "—";
  if (sai < 0) return money(sai).replace("$-", "−$");
  if (sai === 0) return "$0";
  const r = rangeAround(sai, 0.1);
  return formatRangeK(r.low, r.high);
}

function formatImDisplay(im: number | null): string {
  if (im == null) return "—";
  const r = rangeAround(Math.max(0, im), 0.15);
  return formatRangeK(r.low, r.high);
}

function parseMoneyInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number(digits);
}

function formatMoneyInput(n: number): string {
  if (!n) return "";
  return Math.round(n).toLocaleString("en-US");
}

function programStatusLabel(
  status: ProgramStatus,
  detail: string,
): { statusText: string; detailText: string; tone: "accent" | "ink" | "subtle" } {
  const [head, ...rest] = detail.split(". ");
  const statusText = head?.trim() || status;
  const detailText = rest.join(". ").trim();
  if (status === "qualifies" || status === "likely") {
    return { statusText, detailText, tone: "accent" };
  }
  if (status === "possible") {
    return { statusText, detailText, tone: "ink" };
  }
  return { statusText, detailText, tone: "subtle" };
}

function MoneyField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="ff-field">
      <span className="ff-label">{label}</span>
      <span className="ff-money">
        <span className="ff-money-prefix" aria-hidden="true">
          $
        </span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={formatMoneyInput(value)}
          onChange={(e) => onChange(parseMoneyInput(e.target.value))}
        />
      </span>
      {help ? <span className="ff-help">{help}</span> : null}
    </label>
  );
}

function CountField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="ff-field">
      <span className="ff-label">{label}</span>
      <div className="ff-stepper">
        <button
          type="button"
          aria-label="Fewer"
          onClick={() => onChange(Math.max(1, value - 1))}
        >
          −
        </button>
        <span className="ff-stepper-n">{value}</span>
        <button
          type="button"
          aria-label="More"
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
      {help ? <span className="ff-help">{help}</span> : null}
    </div>
  );
}

function ToggleField({
  label,
  help,
  on,
  onToggle,
}: {
  label: string;
  help?: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="ff-toggle"
      aria-pressed={on}
      onClick={onToggle}
    >
      <span className={`ff-toggle-box${on ? " on" : ""}`} aria-hidden="true">
        {on ? "✓" : ""}
      </span>
      <span className="ff-toggle-copy">
        <span className="ff-toggle-label">{label}</span>
        {help ? <span className="ff-help">{help}</span> : null}
      </span>
    </button>
  );
}

export function FamilyFinancesModal({ open, onClose, onSave, schools }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [draft, setDraft] = useState<FamilyFinanceDraft>(EMPTY_FAMILY_DRAFT);
  const [stepId, setStepId] = useState<FamilyStepId>("household");

  const patch = <K extends keyof FamilyFinanceDraft>(
    key: K,
    value: FamilyFinanceDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!open) return;
    setDraft({ ...EMPTY_FAMILY_DRAFT });
    setStepId("household");
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const steps = stepsForDraft(draft);
  const stepIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === stepId),
  );
  const current = steps[stepIndex] ?? steps[0]!;
  const atFirst = stepIndex <= 0;
  const onReview = current.id === "review";
  const stepCount = steps.length;
  const stepNum = stepIndex + 1;

  useEffect(() => {
    if (!open) return;
    const ids = stepsForDraft(draft).map((s) => s.id);
    if (!ids.includes(stepId)) {
      setStepId(ids[Math.max(0, ids.length - 1)] ?? "household");
    }
  }, [draft, open, stepId]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDraft({ ...EMPTY_FAMILY_DRAFT });
      setStepId("household");
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleClose() {
    setDraft({ ...EMPTY_FAMILY_DRAFT });
    setStepId("household");
    onClose();
  }

  function goBack() {
    if (atFirst) return;
    const prev = steps[stepIndex - 1];
    if (prev) setStepId(prev.id);
  }

  function goNext() {
    if (onReview) {
      const profile = buildFamilyProfile(draft, schools);
      if (!profile) return;
      onSave(profile);
      handleClose();
      return;
    }
    const next = steps[stepIndex + 1];
    if (next) setStepId(next.id);
  }

  if (!open) return null;

  const hasP =
    draft.sit != null && draft.sit !== "nop" && draft.sit !== "unavail";
  const div = draft.sit === "divorced";
  const two = isTwoParentEarners(draft);
  const earn1 =
    draft.sit === "married" || draft.sit === "together"
      ? "Parent 1 earnings"
      : "Parent’s earnings";
  const earn2 = div ? "Stepparent’s earnings" : "Parent 2 earnings";

  const core = calcCore(draft);
  const cssCount = schools.filter(
    (s) => s.finance?.cssProfileRequired === true,
  ).length;
  const cssExtras = core.cssExtras;
  const previewProfile =
    draft.sit != null ? buildFamilyProfile(draft, schools) : null;
  const programs = previewProfile?.programs ?? [];

  return (
    <div
      className="ff-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        className="ff-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="ff-header">
          <div className="ff-header-row">
            <div className="ff-header-copy">
              <h2 id={titleId} className="ff-title">
                Family finances
              </h2>
              <p className="ff-sub">
                About 5 to 10 minutes. Have the 2025 tax return and current
                account balances to hand.
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="ff-close"
              aria-label="Close"
              onClick={handleClose}
            >
              ×
            </button>
          </div>
          <nav className="ff-steps" aria-label="Family finances steps">
            {steps.map((step, i) => {
              const currentStep = step.id === current.id;
              const done = i < stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`ff-step${currentStep ? " current" : ""}${done ? " done" : ""}`}
                  aria-current={currentStep ? "step" : undefined}
                  onClick={() => setStepId(step.id)}
                >
                  <span className="ff-step-num">
                    {done ? <span className="ff-step-check">✓</span> : i + 1}
                  </span>
                  {step.title}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="ff-body">
          {!onReview ? (
            <>
              <div className="ff-intro">
                <h3 className="ff-step-title">{current.title}</h3>
                <p className="ff-step-intro">
                  {current.id === "household"
                    ? "Who counts for aid in the 2027-28 school year."
                    : current.id === "income"
                      ? "From the 2025 federal tax return."
                      : current.id === "assets"
                        ? "Balances as of today."
                        : current.id === "other-parent"
                          ? "Many CSS Profile schools also ask for the noncustodial parent’s finances."
                          : "Kyle’s own money counts at a higher rate than his parents’."}
                </p>
              </div>

              <div className="ff-grid">
                {current.id === "household" ? (
                  <>
                    <div className="ff-span">
                      <span className="ff-label">Parents’ situation</span>
                      <div className="ff-options">
                        {PARENT_SITUATIONS.map((opt) => {
                          const selected = draft.sit === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              className={`ff-option${selected ? " selected" : ""}`}
                              aria-pressed={selected}
                              onClick={() =>
                                patch("sit", opt.id as ParentSituation)
                              }
                            >
                              <span className="ff-option-label">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {div ? (
                      <>
                        <ToggleField
                          label="The reporting parent has remarried"
                          help="The stepparent’s income and assets then count too."
                          on={draft.remarried}
                          onToggle={() => patch("remarried", !draft.remarried)}
                        />
                        <p className="ff-note">
                          The FAFSA uses the parent who gave Kyle more financial
                          support in the last 12 months. Enter that parent’s
                          figures in Income and Assets.
                        </p>
                      </>
                    ) : null}

                    {draft.sit === "nop" ? (
                      <p className="ff-note">
                        Kyle files as an independent student. Only his own income
                        and assets count, so the parent sections are skipped.
                      </p>
                    ) : null}

                    {draft.sit === "unavail" ? (
                      <p className="ff-note">
                        Kyle can file the FAFSA without parent information, but
                        each aid office must approve a dependency override before
                        it awards aid. The estimates assume the override is
                        approved.
                      </p>
                    ) : null}

                    <CountField
                      label="People in the household"
                      help={
                        hasP
                          ? "Kyle, his parents (and stepparent), and anyone they support more than half."
                          : "Kyle, plus a spouse or dependents."
                      }
                      value={draft.hh}
                      onChange={(n) => patch("hh", n)}
                    />
                    <CountField
                      label="In college in 2027-28"
                      help="Include Kyle. Don’t count parents."
                      value={draft.nic}
                      onChange={(n) => patch("nic", n)}
                    />

                    <div className="ff-span">
                      <span className="ff-label">State of legal residence</span>
                      <div className="ff-options">
                        <button
                          type="button"
                          className={`ff-option${draft.state === "NJ" ? " selected" : ""}`}
                          aria-pressed={draft.state === "NJ"}
                          onClick={() => patch("state", "NJ")}
                        >
                          <span className="ff-option-label">New Jersey</span>
                          <span className="ff-option-sub">
                            Qualifies for NJ state aid
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`ff-option${draft.state === "other" ? " selected" : ""}`}
                          aria-pressed={draft.state === "other"}
                          onClick={() => patch("state", "other")}
                        >
                          <span className="ff-option-label">Another state</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}

                {current.id === "income" ? (
                  <>
                    <MoneyField
                      label="Adjusted gross income"
                      help={`Form 1040, line 11${two ? ", combined" : ""}.`}
                      value={draft.agi}
                      onChange={(n) => patch("agi", n)}
                    />
                    <MoneyField
                      label="Federal income tax paid"
                      help="Form 1040, line 22."
                      value={draft.tax}
                      onChange={(n) => patch("tax", n)}
                    />
                    <MoneyField
                      label={earn1}
                      help="Wages plus self-employment income."
                      value={draft.p1}
                      onChange={(n) => patch("p1", n)}
                    />
                    {two ? (
                      <MoneyField
                        label={earn2}
                        help="Wages plus self-employment income."
                        value={draft.p2}
                        onChange={(n) => patch("p2", n)}
                      />
                    ) : null}
                    <MoneyField
                      label="Untaxed income"
                      help="Tax-exempt interest, untaxed IRA or pension distributions."
                      value={draft.untaxed}
                      onChange={(n) => patch("untaxed", n)}
                    />
                    <MoneyField
                      label="Child support received"
                      help="For the last year. The FAFSA counts it as an asset."
                      value={draft.cs}
                      onChange={(n) => patch("cs", n)}
                    />
                    <ToggleField
                      label="Self-employed, or own a business or farm"
                      help="Adds a business value field under Assets."
                      on={draft.self}
                      onToggle={() => patch("self", !draft.self)}
                    />
                    <ToggleField
                      label="Income has dropped since 2025"
                      help="Job loss, reduced hours, retirement or a one-time bonus in 2025."
                      on={draft.chgJob}
                      onToggle={() => patch("chgJob", !draft.chgJob)}
                    />
                    <ToggleField
                      label="Large medical, dental or care costs"
                      help="Aid offices can adjust for these."
                      on={draft.chgMed}
                      onToggle={() => patch("chgMed", !draft.chgMed)}
                    />
                    <ToggleField
                      label="Other hardship"
                      help="Supporting a relative, disaster, divorce in progress, or a death in the family."
                      on={draft.chgOther}
                      onToggle={() => patch("chgOther", !draft.chgOther)}
                    />
                  </>
                ) : null}

                {current.id === "assets" ? (
                  <>
                    <MoneyField
                      label="Cash, savings and checking"
                      value={draft.cash}
                      onChange={(n) => patch("cash", n)}
                    />
                    <MoneyField
                      label="Investments"
                      help="Stocks, bonds, funds, crypto and 529 plans. Not retirement accounts."
                      value={draft.inv}
                      onChange={(n) => patch("inv", n)}
                    />
                    <MoneyField
                      label="Other real estate equity"
                      help="Value minus debt, not counting your home."
                      value={draft.re}
                      onChange={(n) => patch("re", n)}
                    />
                    {draft.self ? (
                      <MoneyField
                        label="Business or farm net worth"
                        help="Value minus debt. The FAFSA counts it."
                        value={draft.biz}
                        onChange={(n) => patch("biz", n)}
                      />
                    ) : null}
                    <MoneyField
                      label="Home equity"
                      help="Market value minus mortgage. The FAFSA ignores it; most CSS Profile schools count it."
                      value={draft.home}
                      onChange={(n) => patch("home", n)}
                    />
                    <MoneyField
                      label="Retirement accounts"
                      help="401(k), IRA, pensions. Not counted, but the CSS Profile asks."
                      value={draft.ret}
                      onChange={(n) => patch("ret", n)}
                    />
                  </>
                ) : null}

                {current.id === "other-parent" ? (
                  <>
                    <MoneyField
                      label="Their income"
                      help="Adjusted gross income, if known."
                      value={draft.opInc}
                      onChange={(n) => patch("opInc", n)}
                    />
                    <MoneyField
                      label="Their assets"
                      help="Savings, investments and home equity."
                      value={draft.opAst}
                      onChange={(n) => patch("opAst", n)}
                    />
                    <ToggleField
                      label="They can’t or won’t take part"
                      help="Each school decides whether to waive this. Ask for a noncustodial parent waiver."
                      on={draft.opNone}
                      onToggle={() => patch("opNone", !draft.opNone)}
                    />
                  </>
                ) : null}

                {current.id === "kyle" ? (
                  <>
                    <MoneyField
                      label="Kyle’s 2025 income"
                      help="Summer and part-time jobs."
                      value={draft.kInc}
                      onChange={(n) => patch("kInc", n)}
                    />
                    <MoneyField
                      label="Kyle’s savings and investments"
                      help="Includes UTMA and UGMA accounts in his name."
                      value={draft.kAst}
                      onChange={(n) => patch("kAst", n)}
                    />
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="ff-intro">
                <h3 className="ff-step-title">Review</h3>
                <p className="ff-step-intro">
                  What these figures suggest. Nothing is saved until you press
                  Save.
                </p>
              </div>

              <div className="ff-review-figures">
                <div className="ff-review-fig">
                  <span className="ff-mono-label">
                    Student Aid Index (FAFSA)
                  </span>
                  <span className="ff-review-value">
                    {formatSaiDisplay(core.sai)}
                  </span>
                  <span className="ff-review-sub">
                    {core.autoLow
                      ? "Income is low enough for an automatic minimum aid index."
                      : "Federal formula. Most public universities use this figure."}
                  </span>
                </div>
                <div className="ff-review-fig">
                  <span className="ff-mono-label">CSS Profile schools</span>
                  <span className="ff-review-value">
                    {formatImDisplay(core.im)}
                  </span>
                  <span className="ff-review-sub">
                    {cssCount} schools on your list use the CSS Profile. It adds{" "}
                    {cssExtras.length
                      ? cssExtras.join(", ")
                      : "nothing extra for your situation"}
                    .
                  </span>
                </div>
              </div>

              <div className="ff-progs">
                {programs.map((p) => {
                  const row = programStatusLabel(p.status, p.detail);
                  return (
                    <div key={p.key} className="ff-prog-row">
                      <span className="ff-prog-name">{p.label}</span>
                      <span className={`ff-prog-status ${row.tone}`}>
                        {row.statusText}
                      </span>
                      <span className="ff-prog-detail">{row.detailText}</span>
                    </div>
                  );
                })}
              </div>

              <div className="ff-saved-box">
                <span className="ff-saved-title">What gets saved</span>
                <span className="ff-saved-text">
                  Income band ({core.band}), aid index ranges, Pell and program
                  eligibility, which CSS Profile items apply, and the per-school
                  estimates.
                </span>
                <span className="ff-saved-text">
                  Raw figures like income and balances are cleared when you
                  close. To update, enter them again.
                </span>
              </div>
            </>
          )}
        </div>

        <footer className="ff-footer">
          <button
            type="button"
            className="ff-btn-back"
            onClick={goBack}
            disabled={atFirst}
            style={{ opacity: atFirst ? 0.45 : 1 }}
          >
            Back
          </button>
          <span className="ff-step-count">
            Step {stepNum} of {stepCount}
          </span>
          <button
            type="button"
            className="ff-btn-next"
            onClick={goNext}
            disabled={onReview && !draft.sit}
          >
            {onReview ? "Save estimates" : "Next"}
          </button>
        </footer>
      </div>
    </div>
  );
}
