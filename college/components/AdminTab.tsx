"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatAdminWhen,
  type AdminHygiene,
  type AdminMemberRow,
  type AdminPulse,
} from "@/lib/admin";
import {
  entityTypeLabel,
  formatActivityWhen,
  type ActivityEntry,
} from "@/lib/activity-log";

type Overview = {
  members: AdminMemberRow[];
  pulse: AdminPulse;
  hygiene: AdminHygiene;
  activity: ActivityEntry[];
  loginUrl: string;
};

function HygieneList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { id: string; name: string }[];
  empty: string;
}) {
  return (
    <div className="admin-hygiene-block">
      <h4>
        {title} <span className="mono">{rows.length}</span>
      </h4>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="admin-name-list">
          {rows.slice(0, 12).map((row) => (
            <li key={row.id}>{row.name}</li>
          ))}
          {rows.length > 12 ? <li className="muted">+{rows.length - 12} more</li> : null}
        </ul>
      )}
    </div>
  );
}

export function AdminTab({ dateline }: { dateline: string }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [draftEmails, setDraftEmails] = useState<Record<string, string>>({});
  const [magicLinks, setMagicLinks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/overview");
      const body = (await response.json()) as Overview & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load admin");
      setData(body);
      const emails: Record<string, string> = {};
      for (const member of body.members) {
        emails[member.id] = member.email ?? "";
      }
      setDraftEmails(emails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMember(memberId: string, patch: { email?: string; uiVisible?: boolean }) {
    setBusyId(memberId);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not update member");
      setNotice("Saved.");
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update member");
    } finally {
      setBusyId("");
    }
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`Copied ${label}.`);
    } catch {
      setNotice(`Could not copy ${label}.`);
    }
  }

  async function generateInvite(memberId: string) {
    setBusyId(memberId);
    setNotice("");
    try {
      const response = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const body = (await response.json()) as {
        error?: string;
        magicLink?: string | null;
        loginUrl?: string;
      };
      if (!response.ok) throw new Error(body.error || "Could not generate link");
      if (body.magicLink) {
        setMagicLinks((current) => ({ ...current, [memberId]: body.magicLink! }));
        await copyText("magic link", body.magicLink);
      } else if (body.loginUrl) {
        await copyText("login URL", body.loginUrl);
      } else {
        setNotice("Link generated, but none returned.");
      }
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not generate link");
    } finally {
      setBusyId("");
    }
  }

  const pulse = data?.pulse;
  const hygiene = data?.hygiene;

  return (
    <section className="admin-panel">
      <header className="page-head">
        <div>
          <div className="dateline">{dateline}</div>
          <h2>Admin</h2>
        </div>
      </header>
      <p className="section-sub">
        Creator tools for household access, site health, data hygiene, and the activity trail. Only
        visible to you.
      </p>

      {loading ? <p className="todo-empty">Loading admin…</p> : null}
      {error ? <p className="ingest-error">{error}</p> : null}
      {notice ? <p className="login-message">{notice}</p> : null}

      {data && pulse && hygiene ? (
        <>
          <section className="admin-section" aria-labelledby="admin-access-h">
            <h3 id="admin-access-h">Household access</h3>
            <p className="section-sub">
              Login page:{" "}
              <button
                type="button"
                className="btn btn-ghost admin-inline-btn"
                onClick={() => void copyText("login URL", data.loginUrl)}
              >
                {data.loginUrl}
              </button>
            </p>
            <div className="table-wrap">
              <table className="admin-members">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>On site</th>
                    <th>Signed in</th>
                    <th>Invite</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="admin-person">
                          <strong>{member.displayName}</strong>
                          <span className="mono muted">{member.id}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-email-row">
                          <input
                            className="field"
                            type="email"
                            value={draftEmails[member.id] ?? ""}
                            aria-label={`Email for ${member.displayName}`}
                            onChange={(event) =>
                              setDraftEmails((current) => ({
                                ...current,
                                [member.id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busyId === member.id}
                            onClick={() =>
                              void saveMember(member.id, {
                                email: draftEmails[member.id] ?? "",
                              })
                            }
                          >
                            Save
                          </button>
                        </div>
                      </td>
                      <td>{member.roleLabel}</td>
                      <td>
                        <label className="admin-toggle">
                          <input
                            type="checkbox"
                            checked={member.uiVisible}
                            disabled={busyId === member.id || member.id === "jason"}
                            onChange={(event) =>
                              void saveMember(member.id, { uiVisible: event.target.checked })
                            }
                          />
                          <span>{member.uiVisible ? "On" : "Off"}</span>
                        </label>
                      </td>
                      <td>
                        <div>{member.hasAuth ? "Linked" : "Not yet"}</div>
                        <div className="muted mono">{formatAdminWhen(member.lastSignInAt)}</div>
                      </td>
                      <td>
                        <div className="admin-invite-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busyId === member.id || !member.uiVisible || !draftEmails[member.id]}
                            onClick={() => void generateInvite(member.id)}
                          >
                            Magic link
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => void copyText("login URL", data.loginUrl)}
                          >
                            Copy login
                          </button>
                        </div>
                        {magicLinks[member.id] ? (
                          <p className="admin-magic-note muted">
                            Link generated — also on your clipboard. It expires; generate again if
                            needed.
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-section" aria-labelledby="admin-pulse-h">
            <h3 id="admin-pulse-h">Pulse</h3>
            <dl className="admin-pulse-grid">
              <div>
                <dt>Site</dt>
                <dd>
                  <a href={pulse.siteUrl} target="_blank" rel="noreferrer">
                    {pulse.siteUrl}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Supabase</dt>
                <dd className={pulse.supabase ? "ok" : "bad"}>{pulse.supabase ? "Connected" : "Missing"}</dd>
              </div>
              <div>
                <dt>Auth</dt>
                <dd className={pulse.auth ? "ok" : "bad"}>{pulse.auth ? "Configured" : "Missing anon key"}</dd>
              </div>
              <div>
                <dt>AI gateway</dt>
                <dd className={pulse.aiGateway ? "ok" : "bad"}>
                  {pulse.aiGateway ? "Ready" : "Not configured"}
                </dd>
              </div>
              <div>
                <dt>AI model</dt>
                <dd className="mono">{pulse.aiModel}</dd>
              </div>
              <div>
                <dt>Scorecard key</dt>
                <dd className={pulse.scorecard === "live" ? "ok" : "warn"}>
                  {pulse.scorecard === "live" ? "Live key" : "Demo key"}
                </dd>
              </div>
              <div>
                <dt>Schools</dt>
                <dd>
                  {pulse.schoolCount} live
                  {pulse.archivedCount ? ` · ${pulse.archivedCount} archived` : ""}
                </dd>
              </div>
              <div>
                <dt>Gaps</dt>
                <dd>
                  {pulse.missingWebsite} no website · {pulse.missingPrograms} missing programs ·{" "}
                  {pulse.needsCommonApp} need Common App fill
                </dd>
              </div>
              <div>
                <dt>Last school activity</dt>
                <dd>
                  {pulse.lastSchoolActivitySummary || "None yet"}
                  <div className="muted mono">{formatAdminWhen(pulse.lastSchoolActivityAt)}</div>
                </dd>
              </div>
            </dl>
          </section>

          <section className="admin-section" aria-labelledby="admin-hygiene-h">
            <h3 id="admin-hygiene-h">Data hygiene</h3>
            <div className="admin-phase-bars">
              {hygiene.phaseCounts.map((phase) => (
                <div key={phase.id} className="admin-phase-bar">
                  <div className="admin-phase-label">
                    <strong>{phase.label}</strong>
                    <span className="mono">
                      {phase.count} / {phase.target}
                    </span>
                  </div>
                  <div className="admin-phase-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.min(100, (phase.count / Math.max(phase.target, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="muted">Target range {phase.rangeLabel}</div>
                </div>
              ))}
            </div>
            <p className="section-sub">
              Archived schools: <strong>{hygiene.archivedCount}</strong>
              {hygiene.seniorCycleDeadlines.length
                ? ` · ${hygiene.seniorCycleDeadlines.length} senior-cycle deadlines still on the list`
                : " · No senior-cycle deadlines"}
            </p>
            <div className="admin-hygiene-grid">
              <HygieneList title="Blank interest" rows={hygiene.blankInterest} empty="All set." />
              <HygieneList title="No selectivity tier" rows={hygiene.noTier} empty="All set." />
              <HygieneList title="Missing website" rows={hygiene.missingWebsite} empty="All set." />
              <HygieneList
                title="Missing mech / materials / aero"
                rows={hygiene.missingPrograms}
                empty="All set."
              />
            </div>
            {hygiene.seniorCycleDeadlines.length ? (
              <div className="admin-hygiene-block">
                <h4>Senior-cycle deadlines (wrong year)</h4>
                <ul className="admin-name-list">
                  {hygiene.seniorCycleDeadlines.slice(0, 15).map((row) => (
                    <li key={`${row.id}-${row.title}-${row.dueDate}`}>
                      {row.name} — {row.title}{" "}
                      <span className="mono">{row.dueDate}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="admin-section" aria-labelledby="admin-log-h">
            <h3 id="admin-log-h">Activity</h3>
            <p className="section-sub">Same trail as Log, kept here for creator monitoring.</p>
            {!data.activity.length ? (
              <p className="todo-empty">No activity recorded yet.</p>
            ) : (
              <ol className="log-list">
                {data.activity.map((entry) => (
                  <li key={entry.id} className="log-entry">
                    <div className="log-when mono">{formatActivityWhen(entry.createdAt)}</div>
                    <div className="log-body">
                      <div className="log-meta">
                        <span className="log-actor">{entry.actorName}</span>
                        <span className="log-entity">{entityTypeLabel(entry.entityType)}</span>
                      </div>
                      <p className="log-summary">{entry.summary}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
