/**
 * Canonical Kyle-list ids for Scorecard unit IDs we already researched.
 * When add-school hits one of these, prefer the short seed id + display name
 * so catalog JSON (programs, submissions) keyed by that id still applies.
 */

export type CanonicalSchool = {
  id: string;
  name: string;
};

/** Scorecard unitId → preferred school id + display name from the original list. */
export const CANONICAL_BY_UNIT_ID: Readonly<Record<number, CanonicalSchool>> = {
  110635: { id: "uc-berkeley", name: "University of California, Berkeley (UC Berkeley)" },
  110644: { id: "uc-davis", name: "University of California, Davis (UC Davis)" },
  110653: { id: "uc-irvine", name: "University of California, Irvine (UC Irvine)" },
  110662: { id: "ucla", name: "University of California, Los Angeles (UCLA)" },
  126775: { id: "colorado-school-of-mines", name: "Colorado School of Mines" },
  129020: { id: "uconn", name: "University of Connecticut (UConn)" },
  130943: { id: "university-of-delaware", name: "University of Delaware" },
  134130: { id: "university-of-florida", name: "University of Florida" },
  139755: { id: "georgia-tech", name: "Georgia Institute of Technology (Georgia Tech)" },
  145637: { id: "uiuc", name: "University of Illinois Urbana-Champaign (UIUC)" },
  147767: { id: "northwestern-university", name: "Northwestern University" },
  152318: {
    id: "rose-hulman-institute-of-technology",
    name: "Rose-Hulman Institute of Technology",
  },
  153603: { id: "iowa-state-university", name: "Iowa State University" },
  162928: { id: "johns-hopkins-university", name: "Johns Hopkins University" },
  163286: {
    id: "university-of-maryland-college-park",
    name: "University of Maryland, College Park",
  },
  166683: { id: "mit", name: "Massachusetts Institute of Technology (MIT)" },
  168421: { id: "wpi", name: "Worcester Polytechnic Institute (WPI)" },
  170976: {
    id: "university-of-michigan-ann-arbor",
    name: "University of Michigan–Ann Arbor",
  },
  171128: {
    id: "michigan-tech",
    name: "Michigan Technological University (Michigan Tech)",
  },
  174066: {
    id: "university-of-minnesota-twin-cities",
    name: "University of Minnesota Twin Cities",
  },
  185828: {
    id: "njit",
    name: "New Jersey Institute of Technology (NJIT)",
  },
  186380: {
    id: "rutgers-university-new-brunswick",
    name: "Rutgers University–New Brunswick",
  },
  186867: {
    id: "stevens-institute-of-technology",
    name: "Stevens Institute of Technology",
  },
  190415: { id: "cornell-university", name: "Cornell University" },
  194824: { id: "rpi", name: "Rensselaer Polytechnic Institute (RPI)" },
  197133: { id: "vassar-college", name: "Vassar College" },
  199193: {
    id: "nc-state",
    name: "North Carolina State University (NC State)",
  },
  201645: {
    id: "case-western-reserve-university",
    name: "Case Western Reserve University",
  },
  204796: { id: "ohio-state-university", name: "Ohio State University" },
  211440: { id: "cmu", name: "Carnegie Mellon University (CMU)" },
  212054: { id: "drexel-university", name: "Drexel University" },
  213543: { id: "lehigh-university", name: "Lehigh University" },
  214777: {
    id: "penn-state",
    name: "Pennsylvania State University (Penn State)",
  },
  215062: { id: "upenn", name: "University of Pennsylvania (UPenn)" },
  215293: { id: "university-of-pittsburgh", name: "University of Pittsburgh" },
  217882: { id: "clemson-university", name: "Clemson University" },
  221759: {
    id: "university-of-tennessee-knoxville",
    name: "University of Tennessee, Knoxville",
  },
  228723: { id: "texas-a-and-m-university", name: "Texas A&M University" },
  228778: {
    id: "ut-austin",
    name: "University of Texas at Austin (UT Austin)",
  },
  233921: {
    id: "virginia-tech",
    name: "Virginia Polytechnic Institute and State University (Virginia Tech)",
  },
  234076: { id: "uva", name: "University of Virginia (UVA)" },
  236948: { id: "university-of-washington", name: "University of Washington" },
  240444: {
    id: "university-of-wisconsin-madison",
    name: "University of Wisconsin–Madison",
  },
  243744: { id: "stanford-university", name: "Stanford University" },
  243780: { id: "purdue-university", name: "Purdue University" },
};

export function canonicalForUnitId(unitId: number): CanonicalSchool | null {
  return CANONICAL_BY_UNIT_ID[unitId] ?? null;
}

/** Normalize school names for catalog matching (campus suffixes, punctuation). */
export function normalizeCatalogName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[–—]/g, " ")
    .replace(/\bpittsburgh campus\b/g, " ")
    .replace(/\bmain campus\b/g, " ")
    .replace(/\buniversity\b/g, " ")
    .replace(/\bcollege\b/g, " ")
    .replace(/\sthe\s/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
