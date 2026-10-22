/**
 * Fun icons for Family Meeting events, picked from title/location keywords.
 * Prefer a clear match; fall back to a calm default.
 */

export type FamilyMeetingIconId =
  | "train"
  | "bus"
  | "plane"
  | "car"
  | "bike"
  | "ship"
  | "cake"
  | "gift"
  | "party"
  | "music"
  | "recycle"
  | "leaf"
  | "cat"
  | "paw"
  | "droplet"
  | "vacuum"
  | "home"
  | "school"
  | "book"
  | "doctor"
  | "tooth"
  | "sport"
  | "dumbbell"
  | "food"
  | "coffee"
  | "shop"
  | "film"
  | "game"
  | "baby"
  | "heart"
  | "trees"
  | "sun"
  | "star"
  | "calendar";

type IconRule = { icon: FamilyMeetingIconId; re: RegExp };

/** First match wins — order from specific → general. */
const RULES: IconRule[] = [
  { icon: "train", re: /\b(train|amtrak|metro.?north|lirr|subway|rail)\b/i },
  { icon: "plane", re: /\b(flight|fly|airport|airplane|plane)\b/i },
  { icon: "bus", re: /\b(bus|coach)\b/i },
  { icon: "ship", re: /\b(ferry|boat|cruise)\b/i },
  { icon: "bike", re: /\b(bike|bicycle|cycling)\b/i },
  { icon: "cake", re: /\b(birthday|bday|b\-day)\b/i },
  { icon: "party", re: /\b(party|celebration|celebrate)\b/i },
  { icon: "gift", re: /\b(gift|present|hanukkah|christmas|holiday)\b/i },
  { icon: "music", re: /\b(playlist|songs?|music|concert|piano|guitar|choir|band)\b/i },
  { icon: "recycle", re: /\bcompost|\brecycl|\btrash\b|\bgarbage\b/i },
  { icon: "vacuum", re: /\bvacuum|\bmop\b|\bsweep|\bclean(?:ing)?\b|\bchore\b/i },
  { icon: "cat", re: /\bcats?\b|\bkitten/i },
  { icon: "paw", re: /\bdogs?\b|\bpuppy\b|\bpets?\b|\bvet\b/i },
  { icon: "droplet", re: /\bwater\b|\bhydrate/i },
  { icon: "tooth", re: /\bdentist|\bdental|\borthodont|\bbraces\b|\bteeth\b/i },
  { icon: "doctor", re: /\bdoctor\b|\bdr\.|\bpediatric|\bcheckup\b|\bcheck\-?up\b|\bappt\b|\bappointment\b|\bhospital\b|\burgent care\b|\boptom/i },
  { icon: "school", re: /\bschool\b|\bclass\b|\bhomework\b|\bpta\b|\bparent.?teacher/i },
  { icon: "book", re: /\blibrary\b|\breading\b|\bbooks?\b/i },
  { icon: "sport", re: /\bsoccer\b|\blacrosse\b|\bbaseball\b|\bbasketball\b|\bfootball\b|\bhockey\b|\bswim|\btennis\b|\bpractice\b|\bgames?\b|\btournament\b|\btryouts?\b/i },
  { icon: "dumbbell", re: /\bgym\b|\bworkout\b|\blift\b|\byoga\b|\brun(?:ning)?\b/i },
  { icon: "food", re: /\bdinner\b|\blunch\b|\bbrunch\b|\bbreakfast\b|\brestaurant\b|\bpizza\b|\bbbq\b|\bcook/i },
  { icon: "coffee", re: /\bcoffee\b|\bcafe\b|\btea\b/i },
  { icon: "shop", re: /\bshop(?:ping)?\b|\bgrocery|\berrand|\btarget\b|\bcostco\b/i },
  { icon: "film", re: /\bmovies?\b|\bfilm\b|\btheater\b|\btheatre\b|\bshow\b/i },
  { icon: "game", re: /\bgame night\b|\bvideo games?\b|\bnintendo\b|\bplaystation\b|\bxbox\b/i },
  { icon: "baby", re: /\bbabysit|\bdaycare\b|\bnursery\b/i },
  { icon: "heart", re: /\bdate night\b|\banniversary\b|\bvalentine/i },
  { icon: "trees", re: /\bhike\b|\bcamp(?:ing)?\b|\bpark\b|\bgarden\b|\byard\b|\boutdoor/i },
  { icon: "sun", re: /\bbeach\b|\bpool\b|\bpicnic\b/i },
  { icon: "car", re: /\bdrive\b|\bdriving\b|\buber\b|\blyft\b|\bcarpool\b/i },
  { icon: "home", re: /\bhome\b|\bhouse\b|\bfamily meeting\b/i },
];

export function discernEventIcon(
  title: string,
  location?: string | null
): FamilyMeetingIconId {
  const haystack = `${title} ${location ?? ""}`.trim();
  if (!haystack) return "calendar";
  for (const rule of RULES) {
    if (rule.re.test(haystack)) return rule.icon;
  }
  return "star";
}
