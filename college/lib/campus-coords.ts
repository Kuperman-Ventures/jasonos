/**
 * Known campus coordinates for Visit Planning pins.
 * Prefer these over city-center geocodes so Philly campuses (etc.) don't stack
 * on City Hall when street geocoding is unavailable.
 */

import type { GeoPoint } from "@/lib/visit-geo";

/** Stable school record id → campus lat/lng (admissions / main campus). */
const CAMPUS_COORDS: Record<string, GeoPoint> = {
  upenn: { lat: 39.9522, lng: -75.1932 },
  "drexel-university": { lat: 39.9543, lng: -75.1866 },
  "johns-hopkins-university": { lat: 39.3299, lng: -76.6205 },
  "university-of-maryland-college-park": { lat: 38.9869, lng: -76.9426 },
  mit: { lat: 42.3601, lng: -71.0942 },
  "stanford-university": { lat: 37.4275, lng: -122.1697 },
  "uc-berkeley": { lat: 37.8719, lng: -122.2585 },
  "cornell-university": { lat: 42.4534, lng: -76.4735 },
  "northwestern-university": { lat: 42.0565, lng: -87.6753 },
  cmu: { lat: 40.4433, lng: -79.9436 },
  "penn-state": { lat: 40.7982, lng: -77.8599 },
  "rutgers-university-new-brunswick": { lat: 40.5008, lng: -74.4474 },
  "georgia-tech": { lat: 33.7756, lng: -84.3963 },
  "university-of-michigan-ann-arbor": { lat: 42.278, lng: -83.7382 },
  uiuc: { lat: 40.102, lng: -88.2272 },
  "purdue-university": { lat: 40.4237, lng: -86.9212 },
  "virginia-tech": { lat: 37.2284, lng: -80.4234 },
  uva: { lat: 38.0336, lng: -78.508 },
  "ohio-state-university": { lat: 40.0067, lng: -83.0305 },
  "ut-austin": { lat: 30.2849, lng: -97.7341 },
  "texas-a-and-m-university": { lat: 30.6187, lng: -96.3365 },
  ucla: { lat: 34.0689, lng: -118.4452 },
  "university-of-washington": { lat: 47.6553, lng: -122.3035 },
  "university-of-wisconsin-madison": { lat: 43.0766, lng: -89.4125 },
  "lehigh-university": { lat: 40.6072, lng: -75.3782 },
  "case-western-reserve-university": { lat: 41.5043, lng: -81.6084 },
  "university-of-pittsburgh-pittsburgh-campus": { lat: 40.4442, lng: -79.9606 },
  "university-of-delaware": { lat: 39.6777, lng: -75.7506 },
  njit: { lat: 40.7424, lng: -74.1787 },
  rpi: { lat: 42.73, lng: -73.6767 },
  wpi: { lat: 42.2746, lng: -71.8063 },
  "nc-state": { lat: 35.7847, lng: -78.6821 },
  uconn: { lat: 41.8077, lng: -72.254 },
  "clemson-university": { lat: 34.6834, lng: -82.8374 },
  "colorado-school-of-mines": { lat: 39.7512, lng: -105.222 },
  "iowa-state-university": { lat: 42.0266, lng: -93.6465 },
  "michigan-tech": { lat: 47.1162, lng: -88.5457 },
  "university-of-tennessee-knoxville": { lat: 35.9547, lng: -83.9295 },
  "university-of-minnesota-twin-cities": { lat: 44.974, lng: -93.2277 },
  "uc-davis": { lat: 38.5382, lng: -121.7617 },
  "uc-irvine": { lat: 33.6405, lng: -117.8443 },
};

export function campusCoordsForSchool(schoolId: string): GeoPoint | null {
  return CAMPUS_COORDS[schoolId] ?? null;
}
