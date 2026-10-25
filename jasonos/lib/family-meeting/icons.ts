/**
 * Fun icons for Family Meeting events, picked from title/location keywords.
 * Prefer a clear match; fall back to a calm default.
 */

export type FamilyMeetingIconId =
  | "video"
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

/** All pickable icons for the Family Meeting editor. */
export const FAMILY_MEETING_ICON_IDS: readonly FamilyMeetingIconId[] = [
  "video",
  "train",
  "bus",
  "plane",
  "car",
  "bike",
  "ship",
  "cake",
  "gift",
  "party",
  "music",
  "recycle",
  "leaf",
  "cat",
  "paw",
  "droplet",
  "vacuum",
  "home",
  "school",
  "book",
  "doctor",
  "tooth",
  "sport",
  "dumbbell",
  "food",
  "coffee",
  "shop",
  "film",
  "game",
  "baby",
  "heart",
  "trees",
  "sun",
  "star",
  "calendar",
] as const;

const ICON_ID_SET = new Set<string>(FAMILY_MEETING_ICON_IDS);

export function isFamilyMeetingIconId(
  value: string | null | undefined
): value is FamilyMeetingIconId {
  return Boolean(value && ICON_ID_SET.has(value));
}

export function iconLabel(id: FamilyMeetingIconId): string {
  return id.replace(/_/g, " ");
}

type IconRule = { icon: FamilyMeetingIconId; re: RegExp };

const VIDEO_RE =
  /\b(webex|zoom|gotomeeting|whereby|facetime|webinar|video\s*call|video\s*conference|teams\.microsoft|meet\.google|google\s*meet)\b|https?:\/\/[^\s]*(zoom\.us|webex\.com|meet\.google|teams\.microsoft|gotomeeting\.com)/i;

/** True when the text is (or contains) a video-conference / webinar link. */
export function isVideoConferenceText(text: string): boolean {
  return VIDEO_RE.test(text);
}

/**
 * Location line for the UI — hide raw URLs and meeting-join links.
 * Place cues become the video icon instead.
 */
export function locationForDisplay(location?: string | null): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed) return null;
  if (/https?:\/\//i.test(trimmed)) return null;
  if (isVideoConferenceText(trimmed) && /\.[a-z]{2,}/i.test(trimmed)) {
    // Bare join hosts like "somsdk12.webex.com/…" without scheme
    return null;
  }
  return trimmed;
}

/** First match wins — order from specific → general. */
const RULES: IconRule[] = [
  { icon: "video", re: VIDEO_RE },
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
  { icon: "school", re: /\bschool\b|\bstudent|\bclass\b|\bhomework\b|\bpta\b|\bparent.?teacher/i },
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
  { icon: "car", re: /\bdrive\b|\bdriving\b|\buber\b|\blyft\b|\bcarpool\b|\blicense\b|\bmvc\b/i },
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

/** Prefer a persisted override; otherwise keyword discern. */
export function resolveEventIcon(input: {
  title: string;
  location?: string | null;
  iconId?: FamilyMeetingIconId | null;
}): FamilyMeetingIconId {
  if (isFamilyMeetingIconId(input.iconId)) return input.iconId;
  return discernEventIcon(input.title, input.location);
}
