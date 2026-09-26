/**
 * Major US passenger airports for Visit planning "start from airport" links.
 * Coordinates are airport reference points; nearest is by great-circle distance.
 */

import { haversineMiles, type GeoPoint } from "@/lib/visit-geo";

export type VisitAirport = {
  iata: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

/** Large/medium hub and common college-town airports. */
export const US_VISIT_AIRPORTS: VisitAirport[] = [
  { iata: "ATL", name: "Hartsfield-Jackson Atlanta International", city: "Atlanta", state: "GA", lat: 33.6407, lng: -84.4277 },
  { iata: "BOS", name: "Boston Logan International", city: "Boston", state: "MA", lat: 42.3656, lng: -71.0096 },
  { iata: "BWI", name: "Baltimore/Washington International", city: "Baltimore", state: "MD", lat: 39.1754, lng: -76.6684 },
  { iata: "ORD", name: "Chicago O'Hare International", city: "Chicago", state: "IL", lat: 41.9742, lng: -87.9073 },
  { iata: "MDW", name: "Chicago Midway International", city: "Chicago", state: "IL", lat: 41.7868, lng: -87.7522 },
  { iata: "CVG", name: "Cincinnati/Northern Kentucky International", city: "Hebron", state: "KY", lat: 39.0488, lng: -84.6678 },
  { iata: "CLE", name: "Cleveland Hopkins International", city: "Cleveland", state: "OH", lat: 41.4117, lng: -81.8498 },
  { iata: "CMH", name: "John Glenn Columbus International", city: "Columbus", state: "OH", lat: 39.998, lng: -82.8919 },
  { iata: "DFW", name: "Dallas/Fort Worth International", city: "Dallas", state: "TX", lat: 32.8998, lng: -97.0403 },
  { iata: "DAL", name: "Dallas Love Field", city: "Dallas", state: "TX", lat: 32.8471, lng: -96.8518 },
  { iata: "DEN", name: "Denver International", city: "Denver", state: "CO", lat: 39.8561, lng: -104.6737 },
  { iata: "DTW", name: "Detroit Metropolitan Wayne County", city: "Detroit", state: "MI", lat: 42.2162, lng: -83.3554 },
  { iata: "FLL", name: "Fort Lauderdale-Hollywood International", city: "Fort Lauderdale", state: "FL", lat: 26.0742, lng: -80.1506 },
  { iata: "RSW", name: "Southwest Florida International", city: "Fort Myers", state: "FL", lat: 26.5362, lng: -81.7552 },
  { iata: "GRR", name: "Gerald R. Ford International", city: "Grand Rapids", state: "MI", lat: 42.8808, lng: -85.5228 },
  { iata: "BDL", name: "Bradley International", city: "Windsor Locks", state: "CT", lat: 41.9389, lng: -72.6832 },
  { iata: "IAH", name: "George Bush Intercontinental", city: "Houston", state: "TX", lat: 29.9902, lng: -95.3368 },
  { iata: "HOU", name: "William P. Hobby", city: "Houston", state: "TX", lat: 29.6454, lng: -95.2789 },
  { iata: "IND", name: "Indianapolis International", city: "Indianapolis", state: "IN", lat: 39.7173, lng: -86.2944 },
  { iata: "JAX", name: "Jacksonville International", city: "Jacksonville", state: "FL", lat: 30.4941, lng: -81.6879 },
  { iata: "MCI", name: "Kansas City International", city: "Kansas City", state: "MO", lat: 39.2976, lng: -94.7139 },
  { iata: "LAX", name: "Los Angeles International", city: "Los Angeles", state: "CA", lat: 33.9425, lng: -118.4081 },
  { iata: "SNA", name: "John Wayne / Orange County", city: "Santa Ana", state: "CA", lat: 33.6762, lng: -117.8675 },
  { iata: "BUR", name: "Hollywood Burbank", city: "Burbank", state: "CA", lat: 34.2006, lng: -118.3585 },
  { iata: "LAS", name: "Harry Reid International", city: "Las Vegas", state: "NV", lat: 36.084, lng: -115.1537 },
  { iata: "MEM", name: "Memphis International", city: "Memphis", state: "TN", lat: 35.0424, lng: -89.9767 },
  { iata: "MIA", name: "Miami International", city: "Miami", state: "FL", lat: 25.7959, lng: -80.287 },
  { iata: "MKE", name: "Milwaukee Mitchell International", city: "Milwaukee", state: "WI", lat: 42.9472, lng: -87.8966 },
  { iata: "MSP", name: "Minneapolis−Saint Paul International", city: "Minneapolis", state: "MN", lat: 44.8848, lng: -93.2223 },
  { iata: "BNA", name: "Nashville International", city: "Nashville", state: "TN", lat: 36.1263, lng: -86.6774 },
  { iata: "MSY", name: "Louis Armstrong New Orleans International", city: "New Orleans", state: "LA", lat: 29.9934, lng: -90.258 },
  { iata: "JFK", name: "John F. Kennedy International", city: "New York", state: "NY", lat: 40.6413, lng: -73.7781 },
  { iata: "LGA", name: "LaGuardia", city: "New York", state: "NY", lat: 40.7769, lng: -73.874 },
  { iata: "EWR", name: "Newark Liberty International", city: "Newark", state: "NJ", lat: 40.6895, lng: -74.1745 },
  { iata: "ORF", name: "Norfolk International", city: "Norfolk", state: "VA", lat: 36.8946, lng: -76.2012 },
  { iata: "OAK", name: "San Francisco Bay Oakland International", city: "Oakland", state: "CA", lat: 37.7126, lng: -122.2197 },
  { iata: "MCO", name: "Orlando International", city: "Orlando", state: "FL", lat: 28.4312, lng: -81.3081 },
  { iata: "PHL", name: "Philadelphia International", city: "Philadelphia", state: "PA", lat: 39.8744, lng: -75.2424 },
  { iata: "PHX", name: "Phoenix Sky Harbor International", city: "Phoenix", state: "AZ", lat: 33.4373, lng: -112.0078 },
  { iata: "PIT", name: "Pittsburgh International", city: "Pittsburgh", state: "PA", lat: 40.4915, lng: -80.2329 },
  { iata: "PDX", name: "Portland International", city: "Portland", state: "OR", lat: 45.5898, lng: -122.5951 },
  { iata: "PVD", name: "Rhode Island T. F. Green International", city: "Warwick", state: "RI", lat: 41.724, lng: -71.4282 },
  { iata: "RDU", name: "Raleigh-Durham International", city: "Raleigh", state: "NC", lat: 35.8801, lng: -78.788 },
  { iata: "RIC", name: "Richmond International", city: "Richmond", state: "VA", lat: 37.5052, lng: -77.3197 },
  { iata: "SMF", name: "Sacramento International", city: "Sacramento", state: "CA", lat: 38.6954, lng: -121.5908 },
  { iata: "STL", name: "St. Louis Lambert International", city: "St. Louis", state: "MO", lat: 38.7499, lng: -90.3748 },
  { iata: "SLC", name: "Salt Lake City International", city: "Salt Lake City", state: "UT", lat: 40.7899, lng: -111.9791 },
  { iata: "SAT", name: "San Antonio International", city: "San Antonio", state: "TX", lat: 29.5337, lng: -98.4698 },
  { iata: "SAN", name: "San Diego International", city: "San Diego", state: "CA", lat: 32.7338, lng: -117.1933 },
  { iata: "SFO", name: "San Francisco International", city: "San Francisco", state: "CA", lat: 37.6213, lng: -122.379 },
  { iata: "SJC", name: "San Jose Mineta International", city: "San Jose", state: "CA", lat: 37.3639, lng: -121.9289 },
  { iata: "SEA", name: "Seattle-Tacoma International", city: "Seattle", state: "WA", lat: 47.4502, lng: -122.3088 },
  { iata: "GEG", name: "Spokane International", city: "Spokane", state: "WA", lat: 47.6199, lng: -117.5338 },
  { iata: "SYR", name: "Syracuse Hancock International", city: "Syracuse", state: "NY", lat: 43.1112, lng: -76.1063 },
  { iata: "TPA", name: "Tampa International", city: "Tampa", state: "FL", lat: 27.9755, lng: -82.5332 },
  { iata: "IAD", name: "Washington Dulles International", city: "Dulles", state: "VA", lat: 38.9531, lng: -77.4565 },
  { iata: "DCA", name: "Ronald Reagan Washington National", city: "Arlington", state: "VA", lat: 38.8512, lng: -77.0402 },
  { iata: "PBI", name: "Palm Beach International", city: "West Palm Beach", state: "FL", lat: 26.6832, lng: -80.0956 },
  { iata: "BUF", name: "Buffalo Niagara International", city: "Buffalo", state: "NY", lat: 42.9405, lng: -78.7322 },
  { iata: "ROC", name: "Frederick Douglass Greater Rochester International", city: "Rochester", state: "NY", lat: 43.1189, lng: -77.6724 },
  { iata: "ALB", name: "Albany International", city: "Albany", state: "NY", lat: 42.7483, lng: -73.8017 },
  { iata: "BTV", name: "Burlington International", city: "South Burlington", state: "VT", lat: 44.4719, lng: -73.1533 },
  { iata: "PWM", name: "Portland International Jetport", city: "Portland", state: "ME", lat: 43.6462, lng: -70.3093 },
  { iata: "CHS", name: "Charleston International", city: "Charleston", state: "SC", lat: 32.8986, lng: -80.0405 },
  { iata: "CLT", name: "Charlotte Douglas International", city: "Charlotte", state: "NC", lat: 35.214, lng: -80.9431 },
  { iata: "GSO", name: "Piedmont Triad International", city: "Greensboro", state: "NC", lat: 36.0978, lng: -79.9373 },
  { iata: "SAV", name: "Savannah/Hilton Head International", city: "Savannah", state: "GA", lat: 32.1276, lng: -81.202 },
  { iata: "BHM", name: "Birmingham-Shuttlesworth International", city: "Birmingham", state: "AL", lat: 33.5629, lng: -86.7535 },
  { iata: "BTR", name: "Baton Rouge Metropolitan", city: "Baton Rouge", state: "LA", lat: 30.5332, lng: -91.1496 },
  { iata: "OKC", name: "Will Rogers World", city: "Oklahoma City", state: "OK", lat: 35.3931, lng: -97.6007 },
  { iata: "TUL", name: "Tulsa International", city: "Tulsa", state: "OK", lat: 36.1984, lng: -95.8881 },
  { iata: "ABQ", name: "Albuquerque International Sunport", city: "Albuquerque", state: "NM", lat: 35.0402, lng: -106.6091 },
  { iata: "TUS", name: "Tucson International", city: "Tucson", state: "AZ", lat: 32.1161, lng: -110.941 },
  { iata: "BOI", name: "Boise Airport", city: "Boise", state: "ID", lat: 43.5644, lng: -116.2228 },
  { iata: "ANC", name: "Ted Stevens Anchorage International", city: "Anchorage", state: "AK", lat: 61.1743, lng: -149.9962 },
  { iata: "HNL", name: "Daniel K. Inouye International", city: "Honolulu", state: "HI", lat: 21.3187, lng: -157.9225 },
  { iata: "SJU", name: "Luis Muñoz Marín International", city: "San Juan", state: "PR", lat: 18.4394, lng: -66.0018 },
  { iata: "AUS", name: "Austin-Bergstrom International", city: "Austin", state: "TX", lat: 30.1945, lng: -97.6699 },
  { iata: "COS", name: "Colorado Springs", city: "Colorado Springs", state: "CO", lat: 38.8058, lng: -104.7008 },
  { iata: "DAY", name: "Dayton International", city: "Dayton", state: "OH", lat: 39.9024, lng: -84.2194 },
  { iata: "FWA", name: "Fort Wayne International", city: "Fort Wayne", state: "IN", lat: 40.9785, lng: -85.1951 },
  { iata: "SBN", name: "South Bend International", city: "South Bend", state: "IN", lat: 41.7083, lng: -86.3173 },
  { iata: "CID", name: "The Eastern Iowa", city: "Cedar Rapids", state: "IA", lat: 41.8847, lng: -91.7108 },
  { iata: "DSM", name: "Des Moines International", city: "Des Moines", state: "IA", lat: 41.534, lng: -93.6631 },
  { iata: "MSN", name: "Dane County Regional", city: "Madison", state: "WI", lat: 43.1399, lng: -89.3375 },
  { iata: "LAN", name: "Capital Region International", city: "Lansing", state: "MI", lat: 42.7787, lng: -84.5862 },
  { iata: "FNT", name: "Bishop International", city: "Flint", state: "MI", lat: 42.9654, lng: -83.7436 },
  { iata: "AZO", name: "Kalamazoo/Battle Creek International", city: "Kalamazoo", state: "MI", lat: 42.2349, lng: -85.5516 },
  { iata: "ITO", name: "Hilo International", city: "Hilo", state: "HI", lat: 19.7214, lng: -155.0485 },
];

export type NearestAirport = VisitAirport & {
  miles: number;
  /** Origin string for Google/Apple Maps directions. */
  mapOrigin: string;
  /** Short button label, e.g. "ATL · Atlanta". */
  buttonLabel: string;
};

/** Maps-friendly origin for an airport. */
export function airportMapOrigin(airport: VisitAirport): string {
  return `${airport.name} Airport (${airport.iata}), ${airport.city}, ${airport.state}`;
}

export function nearestAirport(
  point: GeoPoint,
  airports: VisitAirport[] = US_VISIT_AIRPORTS,
): NearestAirport | null {
  if (!airports.length) return null;
  let best: VisitAirport | null = null;
  let bestMiles = Number.POSITIVE_INFINITY;
  for (const airport of airports) {
    const miles = haversineMiles(point, { lat: airport.lat, lng: airport.lng });
    if (miles < bestMiles) {
      bestMiles = miles;
      best = airport;
    }
  }
  if (!best) return null;
  const rounded = Math.max(1, Math.round(bestMiles));
  return {
    ...best,
    miles: rounded,
    mapOrigin: airportMapOrigin(best),
    buttonLabel: `${best.iata} · ${best.city}`,
  };
}
