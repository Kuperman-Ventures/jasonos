/** Brand-aligned Phosphor icons for student activities. Persisted on Activity.icon. */

import type { ActivityCategoryId } from "./activities-journal";

export const ACTIVITY_ICON_IDS = [
  "AirplaneTakeoff",
  "Atom",
  "Baby",
  "Barbell",
  "Baseball",
  "Basketball",
  "BookOpenText",
  "Books",
  "BowlingBall",
  "BoxingGlove",
  "Briefcase",
  "Calculator",
  "Camera",
  "Campfire",
  "CarProfile",
  "CashRegister",
  "Certificate",
  "ChalkboardTeacher",
  "ChartLine",
  "Church",
  "Circuitry",
  "Code",
  "Compass",
  "Confetti",
  "CookingPot",
  "Cpu",
  "Crown",
  "CurrencyDollar",
  "Dna",
  "Dog",
  "FilmStrip",
  "FirstAidKit",
  "FlagBanner",
  "FlagCheckered",
  "Flask",
  "Football",
  "FootballHelmet",
  "ForkKnife",
  "GameController",
  "Gavel",
  "GlobeHemisphereWest",
  "Golf",
  "GraduationCap",
  "Guitar",
  "Hammer",
  "HandHeart",
  "Handshake",
  "HandsPraying",
  "HardHat",
  "HeartStraight",
  "Hockey",
  "HouseLine",
  "Leaf",
  "Lego",
  "Lightbulb",
  "MaskHappy",
  "MathOperations",
  "Medal",
  "Megaphone",
  "MicrophoneStage",
  "Microscope",
  "Mosque",
  "Mountains",
  "MusicNotes",
  "NewspaperClipping",
  "PaintBrush",
  "Palette",
  "PawPrint",
  "PersonSimpleBike",
  "PersonSimpleHike",
  "PersonSimpleRun",
  "PersonSimpleSki",
  "PersonSimpleSnowboard",
  "PersonSimpleSwim",
  "PersonSimpleTaiChi",
  "PersonSimpleThrow",
  "PianoKeys",
  "PingPong",
  "Plant",
  "PuzzlePiece",
  "Recycle",
  "Robot",
  "RocketLaunch",
  "Sailboat",
  "Scales",
  "Scissors",
  "ShieldCheck",
  "SoccerBall",
  "Sparkle",
  "StarAndCrescent",
  "StarOfDavid",
  "Storefront",
  "Strategy",
  "Student",
  "SwimmingPool",
  "Target",
  "TennisBall",
  "Tent",
  "Terminal",
  "TestTube",
  "Ticket",
  "TrainSimple",
  "TreeEvergreen",
  "Trophy",
  "UsersThree",
  "VideoCamera",
  "Volleyball",
  "Wrench",
] as const;

export type ActivityIconId = (typeof ACTIVITY_ICON_IDS)[number];

const ICON_SET = new Set<string>(ACTIVITY_ICON_IDS);

export function isActivityIconId(value: unknown): value is ActivityIconId {
  return typeof value === "string" && ICON_SET.has(value);
}

const CATEGORY_ICON: Record<ActivityCategoryId, ActivityIconId> = {
  "school-club": "UsersThree",
  athletics: "Trophy",
  "arts-music-theater": "MusicNotes",
  "volunteering-community-service": "HandHeart",
  "paid-work": "Briefcase",
  internship: "Briefcase",
  research: "Microscope",
  "independent-project-business": "Lightbulb",
  "academic-enrichment": "BookOpenText",
  "other-coursework-training": "Certificate",
  "family-household-responsibilities": "HouseLine",
  "faith-community-group": "HandsPraying",
  "hobby-personal-pursuit": "PuzzlePiece",
  other: "Sparkle",
};

type IconRule = { pattern: RegExp; icon: ActivityIconId };

/** First match wins. More specific phrases come first. */
const KEYWORD_RULES: IconRule[] = [
  { pattern: /\bmarching\b|\bcolor guard\b/, icon: "FlagBanner" },
  { pattern: /\bchoir\b|\bchorus\b|\bsinging\b|\bvoice\b|\ba cappella\b/, icon: "MicrophoneStage" },
  { pattern: /\bpiano\b|\bkeys\b|\bkeyboard\b/, icon: "PianoKeys" },
  { pattern: /\bguitar\b|\bbass\b|\bukulele\b/, icon: "Guitar" },
  { pattern: /\borchestra\b|\bconcert band\b|\bwind ensemble\b|\bjazz band\b|\bensemble\b/, icon: "MusicNotes" },
  { pattern: /\bband\b|\btrumpet\b|\bdrum\b|\bviolin\b|\bcello\b|\bflute\b|\bclarinet\b|\bsax/, icon: "MusicNotes" },
  { pattern: /\btheater\b|\btheatre\b|\bdrama\b|\bacting\b|\bmusical\b|\bplay\b/, icon: "MaskHappy" },
  { pattern: /\bdance\b|\bballet\b|\btap\b|\bhip[\s-]?hop\b/, icon: "PersonSimpleTaiChi" },
  { pattern: /\bcheer\b|\bcheerlead/, icon: "Confetti" },
  { pattern: /\bphotography\b|\bphoto\b/, icon: "Camera" },
  { pattern: /\bfilm\b|\bvideo\b|\bmovie\b|\bcinema\b/, icon: "FilmStrip" },
  { pattern: /\bpaint(?:ing)?\b|\bdrawing\b|\bstudio art\b|\bvisual art/, icon: "PaintBrush" },
  { pattern: /\bpottery\b|\bceramic|\bsculpture\b/, icon: "Palette" },
  { pattern: /\bsew(?:ing)?\b|\bfashion\b|\bcostume/, icon: "Scissors" },

  { pattern: /\brobot/, icon: "Robot" },
  { pattern: /\bcod(?:e|ing)\b|\bcomputer science\b|\bcomp sci\b|\bhackathon\b|\bprogramming\b/, icon: "Code" },
  { pattern: /\bai\b|\bartificial intelligence\b|\bmachine learning\b/, icon: "Cpu" },
  { pattern: /\belectronic|\bcircuit|\bengineering club\b/, icon: "Circuitry" },
  { pattern: /\bchemistry\b|\bchem\b/, icon: "Flask" },
  { pattern: /\bbiolog|\bgenetics\b/, icon: "Dna" },
  { pattern: /\bresearch\b|\blab\b|\bmicroscope\b/, icon: "Microscope" },
  { pattern: /\bscience olympiad\b|\bscience fair\b|\bstem\b/, icon: "TestTube" },
  { pattern: /\bmath(?:letes)?\b|\bcalculus\b|\bgeometry\b/, icon: "MathOperations" },
  { pattern: /\bphysics\b|\batom\b/, icon: "Atom" },
  { pattern: /\blego\b|\bfirst lego\b|\bftc\b|\bfll\b/, icon: "Lego" },
  { pattern: /\brocket|\baerospace\b/, icon: "RocketLaunch" },
  { pattern: /\baviation\b|\bpilot\b|\bflying\b|\bflight\b/, icon: "AirplaneTakeoff" },

  { pattern: /\bsoccer\b/, icon: "SoccerBall" },
  { pattern: /\bbasketball\b/, icon: "Basketball" },
  { pattern: /\bfootball\b|\bgridiron\b/, icon: "Football" },
  { pattern: /\bbaseball\b|\bsoftball\b/, icon: "Baseball" },
  { pattern: /\btennis\b/, icon: "TennisBall" },
  { pattern: /\bvolleyball\b/, icon: "Volleyball" },
  { pattern: /\bhockey\b/, icon: "Hockey" },
  { pattern: /\bgolf\b/, icon: "Golf" },
  { pattern: /\bbowling\b/, icon: "BowlingBall" },
  { pattern: /\bboxing\b|\bmma\b/, icon: "BoxingGlove" },
  { pattern: /\bwrestl/, icon: "Barbell" },
  { pattern: /\blifting\b|\bweight\b|\bgym\b|\bstrength\b/, icon: "Barbell" },
  { pattern: /\bswim|\blifeguard\b/, icon: "PersonSimpleSwim" },
  { pattern: /\btrack\b|\bcross country\b|\brunning\b|\bxc\b/, icon: "PersonSimpleRun" },
  { pattern: /\bcycl|\bbike\b|\bbiking\b/, icon: "PersonSimpleBike" },
  { pattern: /\bski(?:ing)?\b/, icon: "PersonSimpleSki" },
  { pattern: /\bsnowboard/, icon: "PersonSimpleSnowboard" },
  { pattern: /\bhike\b|\bhiking\b|\bbackpack/, icon: "PersonSimpleHike" },
  { pattern: /\bmartial|\btaekwondo\b|\bkarate\b|\bjudo\b|\bkung fu\b|\bbjj\b/, icon: "PersonSimpleThrow" },
  { pattern: /\byoga\b|\bpilates\b/, icon: "PersonSimpleTaiChi" },
  { pattern: /\blacrosse\b|\barchery\b|\bfencing\b/, icon: "Target" },
  { pattern: /\bping pong\b|\btable tennis\b/, icon: "PingPong" },
  { pattern: /\bsail(?:ing)?\b/, icon: "Sailboat" },
  { pattern: /\bcrew\b|\browing\b/, icon: "Sailboat" },
  { pattern: /\bscout|\beagle scout\b|\bgirl scout|\bboy scout/, icon: "Compass" },
  { pattern: /\bcamp counselor\b|\bsummer camp\b/, icon: "Tent" },
  { pattern: /\boutdoor|\bcamping\b/, icon: "Campfire" },

  { pattern: /\bdebate\b|\bspeech\b|\bforensic/, icon: "Megaphone" },
  { pattern: /\bmodel un\b|\bmun\b/, icon: "GlobeHemisphereWest" },
  { pattern: /\bmock trial\b|\bdebate team\b/, icon: "Gavel" },
  { pattern: /\bstudent council\b|\bstu[\s-]?co\b|\bclass president\b|\bgovernment\b/, icon: "UsersThree" },
  { pattern: /\bnational honor|\bnhs\b|\bhonor societ/, icon: "GraduationCap" },
  { pattern: /\byearbook\b/, icon: "Camera" },
  { pattern: /\bnewspaper\b|\bjournalism\b|\bschool paper\b/, icon: "NewspaperClipping" },
  { pattern: /\btutor/, icon: "ChalkboardTeacher" },
  { pattern: /\bchess\b/, icon: "Strategy" },
  { pattern: /\besports\b|\bvideo game|\bgaming\b/, icon: "GameController" },
  { pattern: /\bpuzzle\b|\blego\b/, icon: "PuzzlePiece" },

  { pattern: /\bbabysit|\bsibling care\b|\bchildcare\b|\bnanny\b/, icon: "Baby" },
  { pattern: /\bdog walk|\bpet sit/, icon: "Dog" },
  { pattern: /\banimal shelter\b|\bhumane\b/, icon: "PawPrint" },
  { pattern: /\bcook(?:ing)?\b|\bbak(?:e|ing)\b|\bchef\b|\bkitchen\b/, icon: "CookingPot" },
  { pattern: /\blawn\b|\blandscap|\bgarden/, icon: "Leaf" },
  { pattern: /\bretail\b|\bcashier\b|\bsales\b/, icon: "Storefront" },
  { pattern: /\blifeguard\b/, icon: "SwimmingPool" },
  { pattern: /\bhospital\b|\bemt\b|\bnursing\b|\bmedical\b/, icon: "FirstAidKit" },
  { pattern: /\bsoup kitchen\b|\bfood pantry\b|\bmeal\b/, icon: "ForkKnife" },
  { pattern: /\bvolunteer|\bcommunity service\b/, icon: "HandHeart" },
  { pattern: /\bintern(?:ship)?\b/, icon: "Briefcase" },
  { pattern: /\bjob\b|\bwork\b|\bemployed\b|\bshift\b/, icon: "Briefcase" },
  { pattern: /\bbusiness\b|\bentrepreneur|\bstartup\b/, icon: "Lightbulb" },
  { pattern: /\bconstruct|\bcarpentr|\bhandyman\b/, icon: "Hammer" },

  { pattern: /\bsynagogue\b|\btemple\b|\bjewish\b|\bbnai\b|\bhebrew\b/, icon: "StarOfDavid" },
  { pattern: /\bmosque\b|\bislam|\bmuslim\b/, icon: "Mosque" },
  { pattern: /\bchurch\b|\byouth group\b|\bbible\b|\bconfirmation\b|\baltar\b/, icon: "Church" },
  { pattern: /\bfaith\b|\byouth ministry\b|\breligious\b/, icon: "HandsPraying" },
  { pattern: /\b4[\s-]?h\b|\bffa\b|\bfarm\b/, icon: "Plant" },
];

export type ActivityIconInput = {
  name?: string;
  category?: ActivityCategoryId | string;
  organization?: string;
  icon?: string | null;
};

export function pickActivityIcon(input: ActivityIconInput): ActivityIconId {
  if (isActivityIconId(input.icon)) return input.icon;
  const hay = [input.name, input.organization].filter(Boolean).join(" ").toLowerCase();
  if (hay) {
    for (const rule of KEYWORD_RULES) {
      if (rule.pattern.test(hay)) return rule.icon;
    }
  }
  const category = input.category as ActivityCategoryId | undefined;
  if (category && category in CATEGORY_ICON) return CATEGORY_ICON[category];
  return "Sparkle";
}

/** Stored icon if valid, otherwise a heuristic from the name. */
export function resolveActivityIcon(input: ActivityIconInput): ActivityIconId {
  if (isActivityIconId(input.icon)) return input.icon;
  return pickActivityIcon(input);
}

export function activityIconRequestKey(input: ActivityIconInput): string {
  return [input.name?.trim() ?? "", input.category ?? "", input.organization?.trim() ?? ""].join("|");
}

/** Parse the AI JSON reply. Null when the model did not return an allowlisted icon. */
export function parseActivityIconReply(raw: string): ActivityIconId | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]!.trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(body.slice(start, end + 1)) as { icon?: unknown };
      if (isActivityIconId(parsed.icon)) return parsed.icon;
    } catch {
      /* fall through */
    }
  }
  const quoted = body.match(/"icon"\s*:\s*"([A-Za-z]+)"/);
  if (quoted && isActivityIconId(quoted[1])) return quoted[1];
  if (isActivityIconId(body)) return body;
  return null;
}

export function activityIconPromptList(): string {
  return ACTIVITY_ICON_IDS.join(", ");
}
