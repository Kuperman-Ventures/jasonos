import type { ProjectStatus, Track } from "@/lib/types";

/** Personal project pages live in code. `jasonos.projects` has no slug. */
export const project: {
  slug: string;
  title: string;
  track: Track;
  status: ProjectStatus;
  description: string;
} = {
  slug: "oversight-agenda",
  title: "Oversight Agenda Dashboard",
  track: "personal",
  status: "active",
  description:
    "Six Democratic oversight investigation areas for the 120th Congress, with leads, next steps, and likelihood of moving forward.",
};

export type Likelihood = "high" | "medium" | "low";

export interface OversightArea {
  id: string;
  num: number;
  title: string;
  lead: string;
  likelihood: Likelihood;
  targets: string[];
  nextSteps: string[];
  blockers: string;
  basis: string;
}

export interface TimelineItem {
  when: string;
  what: string;
  why: string;
}

export interface StatusTile {
  label: string;
  value: string;
  note: string;
}

export const updatedOn = "2026-11-05";

export const statusTiles: StatusTile[] = [
  { label: "House", value: "Democratic majority", note: "Projected by ABC, CBS, NBC. Jeffries expects at least 255 seats once counting ends." },
  { label: "Senate", value: "Democratic majority", note: "Projected by NBC. ABC graphic shows a 7-seat Democratic gain." },
  { label: "Oversight powers", value: "Subpoena, compel testimony", note: "Chairs can enforce through civil contempt in court. Garcia says DOJ enforcement is unlikely." },
  { label: "White House position", value: "\"Sham investigations\"", note: "No statement yet on whether it will cooperate with document requests or witness calls." }
];

export const timeline: TimelineItem[] = [
  { when: "Nov 18-19, 2026", what: "House Democratic leadership elections", why: "Jeffries is the declared candidate for Speaker. Committee chair slates follow leadership." },
  { when: "Dec 2026", what: "Chairs ratified, staff hired, document requests drafted", why: "Presumptive chairs are already naming targets and witnesses. Requests go out before formal power arrives." },
  { when: "Jan 3, 2027", what: "120th Congress convenes, Speaker vote", why: "Subpoena power and committee budgets take effect once the House organizes." },
  { when: "Q1 2027", what: "First public hearings", why: "Garcia has committed to public Epstein hearings. Several investigations are expected to launch at once." }
];

export const areas: OversightArea[] = [
  {
    id: "corruption", num: 1, title: "Pay-to-Play and Public Corruption",
    lead: "House Oversight, Rep. Robert Garcia (presumptive chair)", likelihood: "high",
    targets: [
      "Government contractors and no-bid contracts",
      "Individuals who received or purchased presidential pardons",
      "Trump family real estate and business dealings",
      "Cryptocurrency frameworks and defense contracts, and whether donations or relationships drove decisions",
      "Corporate donors to the White House ballroom"
    ],
    nextSteps: [
      "Garcia has named Stephen Miller, Corey Lewandowski, Kristi Noem and Trump family members as witnesses he will call",
      "Interviews sought with Jared Kushner and other family members on business dealings",
      "Subpoena enforcement planned through lawsuits and civil contempt in court"
    ],
    blockers: "DOJ is unlikely to enforce criminal contempt, so non-cooperation drags into litigation. The White House has not committed to cooperating.",
    basis: "The presumptive chair has publicly listed targets and witnesses and described his enforcement plan. This is the most developed area."
  },
  {
    id: "tech", num: 2, title: "Tech Industry and AI Policy",
    lead: "Multiple committees; Judiciary (Rep. Jamie Raskin) on antitrust", likelihood: "medium",
    targets: [
      "Executives and informal presidential advisers who shaped federal policy",
      "Companies that committed resources to presidential priorities in exchange for favorable treatment",
      "Administration AI policy, including export controls on advanced semiconductors",
      "Market concentration and circular investments across the AI value chain"
    ],
    nextSteps: [
      "Raskin has named corporate mergers and antitrust as a Judiciary focus",
      "No chair has announced AI-specific or export-control hearings yet",
      "Likely first step is document requests to agencies that set AI and chip policy"
    ],
    blockers: "Jurisdiction is split across Judiciary, Energy and Commerce, Oversight and Senate committees. Export-control questions touch national security briefings that slow public hearings.",
    basis: "Antitrust has a named chair and a public statement. The AI and export-control pieces appear only in strategy memos so far."
  },
  {
    id: "doj", num: 3, title: "DOJ and Regulatory Interference",
    lead: "House Judiciary (Rep. Jamie Raskin); Senate: Sen. Sheldon Whitehouse (DOJ and antitrust settlements), Sen. Elizabeth Warren (financial regulation)", likelihood: "high",
    targets: [
      "Politicization of DOJ and FBI, firing of career prosecutors, the $1.8 billion Anti-Weaponization fund",
      "DOJ and antitrust settlements in media and entertainment, and whether they benefited private parties",
      "Bank chartering, supervision decisions and tax settlements driven by political favoritism",
      "Handling of the Epstein investigation, including financial institutions and advisors who may have financed it"
    ],
    nextSteps: [
      "Garcia plans public Epstein hearings and may subpoena Attorney General Todd Blanche over withheld pages",
      "Raskin plans Judiciary hearings on DOJ politicization and pay-to-play pardons",
      "Whitehouse and Warren probes on the Senate side have not been formally announced"
    ],
    blockers: "Executive privilege and ongoing-investigation claims from DOJ. Senate committee chairs are not yet confirmed.",
    basis: "Two presumptive House chairs have committed to specific hearings and a possible cabinet-level subpoena. The Senate pieces are expected but not announced, so the rating rests on the House side."
  },
  {
    id: "lands", num: 4, title: "Public Lands and Freedom250",
    lead: "House Natural Resources, Rep. Jared Huffman (expected chair)", likelihood: "low",
    targets: [
      "Management of public lands under the administration's environmental policy",
      "Donations tied to Freedom250, the 250th anniversary program",
      "Whether natural resource policy was traded for political or financial support"
    ],
    nextSteps: [
      "No post-election statement from Huffman on specific hearings or witnesses",
      "Likely to start with document requests to Interior and the Freedom250 commission",
      "Freedom250 events through July 4, 2027 keep the donor question live"
    ],
    blockers: "Not named in any post-election leadership statement. Competes for committee time with legislative priorities and with higher-profile probes.",
    basis: "Appears in strategy memos only. No chair has gone on record since the election."
  },
  {
    id: "cost", num: 5, title: "Corporate Accountability and Cost of Living",
    lead: "Rep. Frank Pallone (Energy and Commerce), Sen. Maria Cantwell (Commerce)", likelihood: "medium",
    targets: [
      "Surveillance pricing: using consumer data to charge variable prices",
      "Healthcare and prescription drug costs",
      "Predatory lending",
      "Utilities, fossil fuel operations and large data centers: electricity costs, water use and grid impact"
    ],
    nextSteps: [
      "Leadership's first legislative moves are affordability bills: ACA premium subsidies and reversing Medicaid cuts",
      "Oversight hearings on pricing and data centers would run alongside that agenda",
      "No specific hearing dates or witness lists announced"
    ],
    blockers: "Leadership wants affordability framed as legislation first. Corporate targets are outside the administration, so hearings draw less media attention than Trump-focused probes.",
    basis: "Named committee leads and a clear leadership priority on cost of living, but no announced hearings. The legislative push may absorb the committee calendar."
  },
  {
    id: "impeachment", num: 6, title: "Impeachment",
    lead: "House Democratic leadership (Speaker-designate Hakeem Jeffries)", likelihood: "low",
    targets: [
      "Would require explicit evidence from the investigations above, such as direct bribery in defense contracting or pardon-selling"
    ],
    nextSteps: [
      "Jeffries: nothing ruled in, nothing ruled out; no caucus member has raised it with him",
      "Raskin: a critical tool, used only if benefits outweigh the cost in time and attention",
      "Any move would follow, not precede, findings from Oversight and Judiciary"
    ],
    blockers: "Senate conviction needs 67 votes, which Democrats do not have. Leadership is prioritizing affordability. Some new members say there is no path to removal.",
    basis: "Leadership has deliberately kept it open as leverage, but no one in leadership is advocating it now and the Senate math rules out removal."
  }
];

export const impeachmentMath: StatusTile[] = [
  { label: "House: to impeach", value: "218", note: "Simple majority. Democrats are projected to hold it." },
  { label: "Senate: to convict", value: "67", note: "Two-thirds. A 7-seat gain leaves Democrats well short without Republican votes." },
  { label: "Leadership stance", value: "Nothing ruled in or out", note: "Jeffries says no caucus member has raised it with him. Raskin calls it a tool to use only if benefits outweigh the cost in time and attention." }
];

export const likelihoodLegend =
  "Likelihood is an analyst assessment of whether formal investigative activity (hearings, subpoenas, document demands) begins in the first half of 2027. High: a named chair has publicly committed to specific targets or witnesses. Medium: the area appears in party strategy memos and leadership statements but no chair has announced specific actions. Low: the area is in memos only, or the path to action faces a structural block.";

export const sources = [
  { title: "ABC News: Democrats take the House. Here's what they plan to investigate", url: "https://abcnews.com/Politics/democrats-house-heres-plan-investigate-legislative-agenda/story?id=137832144" },
  { title: "CBS News: 2026 House election results live updates", url: "https://www.cbsnews.com/live-updates/house-election-results-2026/" },
  { title: "NBC News: Democrats capture full control of Congress, NBC News projects", url: "https://www.nbcnews.com/politics/2026-election/democrats-capture-full-control-congress-nbc-news-projects-fueled-victo-rcna607042" }
];
