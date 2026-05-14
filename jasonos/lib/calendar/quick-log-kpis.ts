/** KPI options for Quick Log and calendar tag modal. */

const SHARED_NETWORKING_KPIS = [
  { mapping: "Warm reconnects sent",     label: "Warm reconnect communications" },
  { mapping: "LinkedIn comments posted", label: "LinkedIn comments posted" },
  { mapping: "Content posts",            label: "Content posts" },
];

export interface KpiItem {
  mapping: string;
  label: string;
}

export interface KpiGroup {
  group: string;
  track: string;
  color: string;
  kpis: KpiItem[];
}

export const QUICK_LOG_KPI_GROUPS: KpiGroup[] = [
  {
    group: "Kuperman Advisors",
    track: "advisors",
    color: "#1E6B3C",
    kpis: [
      { mapping: "Outreach messages sent", label: "Outreach messages sent" },
      { mapping: "Discovery calls booked", label: "Discovery calls booked" },
      { mapping: "Discovery calls held",   label: "Discovery calls held" },
      { mapping: "Connective attendance",  label: "Networking meetings attended" },
      ...SHARED_NETWORKING_KPIS,
    ],
  },
  {
    group: "Shared Networking",
    track: "networking",
    color: "#C2762A",
    kpis: SHARED_NETWORKING_KPIS,
  },
  {
    group: "Job Search",
    track: "jobSearch",
    color: "#2E75B6",
    kpis: [
      { mapping: "Companies researched",   label: "Companies researched" },
      { mapping: "Company outreaches",     label: "Company outreaches" },
      { mapping: "Roles identified",       label: "Roles identified" },
      { mapping: "Applications submitted", label: "Applications submitted" },
      { mapping: "Recruiter touchpoints",  label: "Recruiter touchpoints" },
      ...SHARED_NETWORKING_KPIS,
    ],
  },
  {
    group: "Kuperman Ventures",
    track: "ventures",
    color: "#9B6BAE",
    kpis: [{ mapping: "Tester touchpoints", label: "Alpha tester touchpoints" }],
  },
];

export function quickLogGroupsForTrack(trackKey: string): KpiGroup[] {
  return QUICK_LOG_KPI_GROUPS.filter((g) => g.track === trackKey);
}
