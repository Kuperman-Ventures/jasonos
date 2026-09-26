// Official sites for the original 43 schools.
// Most came from College Scorecard. The rest were confirmed by opening the school's site
// after Scorecard hit its request limit. Purdue is the West Lafayette campus, not Fort Wayne.

const WEBSITES: Record<string, string> = {
  mit: "https://web.mit.edu/",
  "stanford-university": "https://www.stanford.edu/",
  "uc-berkeley": "https://www.berkeley.edu/",
  "cornell-university": "https://www.cornell.edu/",
  "northwestern-university": "https://www.northwestern.edu/",
  cmu: "https://www.cmu.edu/",
  upenn: "https://www.upenn.edu/",
  "johns-hopkins-university": "https://www.jhu.edu/",
  "georgia-tech": "https://www.gatech.edu/",
  "university-of-michigan-ann-arbor": "https://umich.edu/",
  uiuc: "https://www.illinois.edu/",
  "ut-austin": "https://www.utexas.edu/",
  ucla: "https://www.ucla.edu/",
  "purdue-university": "https://www.purdue.edu/",
  "university-of-maryland-college-park": "https://www.umd.edu/",
  "university-of-washington": "https://www.washington.edu/",
  "university-of-wisconsin-madison": "https://www.wisc.edu/",
  "virginia-tech": "https://www.vt.edu/",
  "penn-state": "https://psu.edu/",
  "ohio-state-university": "https://www.osu.edu/",
  "university-of-minnesota-twin-cities": "https://twin-cities.umn.edu/",
  "nc-state": "https://www.ncsu.edu/",
  "uc-davis": "https://www.ucdavis.edu/",
  "uc-irvine": "https://www.uci.edu/",
  "case-western-reserve-university": "https://www.case.edu/",
  rpi: "https://www.rpi.edu/",
  "rutgers-university-new-brunswick": "https://newbrunswick.rutgers.edu/",
  "university-of-florida": "https://www.ufl.edu/",
  "texas-a-and-m-university": "https://www.tamu.edu/",
  "colorado-school-of-mines": "https://www.mines.edu/",
  uva: "https://www.virginia.edu/",
  "lehigh-university": "https://www.lehigh.edu/",
  uconn: "https://uconn.edu/",
  "university-of-delaware": "https://www.udel.edu/",
  "drexel-university": "https://drexel.edu/",
  "iowa-state-university": "https://www.iastate.edu/",
  "clemson-university": "https://www.clemson.edu/",
  "university-of-tennessee-knoxville": "https://www.utk.edu/",
  "michigan-tech": "https://www.mtu.edu/",
  njit: "https://www.njit.edu/",
  wpi: "https://www.wpi.edu/",
  "stevens-institute-of-technology": "https://www.stevens.edu/",
  "rose-hulman-institute-of-technology": "https://www.rose-hulman.edu/",
};

export function knownWebsite(id: string): string {
  return WEBSITES[id] ?? "";
}

export function knownWebsites(): Record<string, string> {
  return WEBSITES;
}
