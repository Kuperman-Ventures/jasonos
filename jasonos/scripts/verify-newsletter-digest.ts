import {
  classifyNewsletterHeading,
  parseMorningBrief,
  parseNewsletterStory,
} from "../lib/data/parse-morning-brief";

// Quick parser checks for the three newsletter buckets. Run from jasonos/:
//   npx tsx scripts/verify-newsletter-digest.ts

let failed = 0;
function assert(name: string, cond: unknown, detail?: unknown) {
  if (cond) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`, detail ?? "");
}

assert(
  "Marketing and Media News → marketing",
  classifyNewsletterHeading("Marketing and Media News") === "marketing"
);
assert(
  "Marketing & Media News → marketing",
  classifyNewsletterHeading("Marketing & Media News") === "marketing"
);
assert(
  "AI and Marketing → ai-marketing",
  classifyNewsletterHeading("AI and Marketing") === "ai-marketing"
);
assert(
  "AI & Marketing → ai-marketing",
  classifyNewsletterHeading("AI and Marketing") === "ai-marketing"
);
assert(
  "AI and Business → ai-general",
  classifyNewsletterHeading("AI and Business") === "ai-general"
);
assert(
  "AI in general → ai-general",
  classifyNewsletterHeading("AI in general") === "ai-general"
);
assert(
  "canonical marketing heading",
  classifyNewsletterHeading("Marketing and advertising") === "marketing"
);
assert(
  "canonical ai-marketing heading",
  classifyNewsletterHeading("AI in marketing and advertising") === "ai-marketing"
);

const story = parseNewsletterStory(
  "- [Nuuly bets on a 12-episode TikTok microdrama](https://www.marketingbrew.com/stories/why-nuuly-is-taking-a-chance-on-microdramas) — Budget is moving from broad channel spread to serialized native formats."
);
assert("story title", story?.title === "Nuuly bets on a 12-episode TikTok microdrama");
assert(
  "story url",
  story?.url ===
    "https://www.marketingbrew.com/stories/why-nuuly-is-taking-a-chance-on-microdramas"
);
assert(
  "story teaser starts with Budget",
  story?.teaser.startsWith("Budget is moving")
);
assert("story summary is full", (story?.summary.length ?? 0) > 40);

const h3 = parseMorningBrief(`# Morning Brief

## Newsletter Digest

### Marketing and Media News

- [Nuuly bets on TikTok](https://example.com/nuuly) — Budget is moving from broad channel spread.
- [FTC warns on personalized pricing](https://example.com/ftc) — Disclosure is now required.

### AI and Marketing

- [McKinsey: 90% use AI](https://example.com/mck) — Only 37% see EBIT impact. The gap is rewired workflows.

### AI and Business

- [Anthropic revenue](https://example.com/anth) — On track to exceed $65B annualized.
`);

assert("H3 digest has 3 groups", h3.newsletters.length === 3);
assert("group 0 marketing", h3.newsletters[0]?.id === "marketing");
assert("group 1 ai-general", h3.newsletters[1]?.id === "ai-general");
assert("group 2 ai-marketing", h3.newsletters[2]?.id === "ai-marketing");
assert("marketing has 2 stories", h3.newsletters[0]?.stories.length === 2);
assert("ai-general has 1 story", h3.newsletters[1]?.stories.length === 1);
assert("ai-marketing has 1 story", h3.newsletters[2]?.stories.length === 1);
assert(
  "canonical titles",
  h3.newsletters[0]?.title === "Marketing and advertising" &&
    h3.newsletters[1]?.title === "AI in general" &&
    h3.newsletters[2]?.title === "AI in marketing and advertising"
);

const bold = parseMorningBrief(`# Morning Brief

## Newsletter Digest

**Marketing & Media News**
- [Holdco H1](https://example.com/h1) — Publicis and Omnicom pulling away.

**AI & Marketing**
- [AIO data](https://example.com/aio) — 7.53% of organic sessions.

**AI and Business**
- [Cursor Origin](https://example.com/cursor) — Launched during a GitHub outage.
`);

assert("bold digest has 3 groups", bold.newsletters.length === 3);
assert("bold marketing count", bold.newsletters[0]?.stories.length === 1);
assert("bold ai-general count", bold.newsletters[1]?.stories.length === 1);
assert("bold ai-marketing count", bold.newsletters[2]?.stories.length === 1);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall passed");
