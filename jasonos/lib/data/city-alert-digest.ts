import type { NewsletterStory } from "@/lib/data/parse-morning-brief";

// Oct 3, 2026 Google Alert daily digest (personal Gmail). The linked
// message is the "smart cities" block. That send had no San Francisco or
// Boston item. Digital-outdoor items in the same email were not about
// those cities either, so they stay out.

export interface CityAlertGroup {
  id: string;
  title: string;
  emptyNote: string;
  stories: NewsletterStory[];
}

const OCT3 = "Oct 3 Google Alert";

export const CITY_ALERT_GROUPS: CityAlertGroup[] = [
  {
    id: "san-francisco",
    title: "San Francisco",
    emptyNote: "No San Francisco story in the Oct 3 alert.",
    stories: [],
  },
  {
    id: "boston",
    title: "Boston",
    emptyNote: "No Boston story in the Oct 3 alert.",
    stories: [],
  },
  {
    id: "smart-cities",
    title: "Smart cities",
    emptyNote: "No smart-city story in the Oct 3 alert.",
    stories: [
      {
        title: "Open-source kit for block-level city data",
        teaser:
          "A University of Cincinnati researcher built a cheap wearable that records a sidewalk instead of a whole city.",
        summary: `Henry Levesque, a doctoral student at the University of Cincinnati, published an open-source data kit for smart-city research. Worn on a hat or helmet, it captures images of the wearer and what they are looking at, plus GPS. Extra sensors can add temperature, humidity, and air quality. He uses it for a single block or intersection. The files stay in ordinary formats. Source: Phys.org, Oct 2, 2026. ${OCT3}.`,
        url: "https://phys.org/news/2026-10-rethinking-smart-cities-source-tool.html",
      },
      {
        title: "Cities test small before they scale AI",
        teaser:
          "Trenton mapped a messy property process first. New Bedford, Mass. dropped spreadsheet meetings and mapped fires.",
        summary: `At Smart Cities Connect, two Bloomberg Harvard fellows said start with the process, then the software. In Trenton, Naman Sharma found staff using different versions of the same property-disposal process. Nearly 10% of the building stock was abandoned and about half of that was city-owned. The city agreed on one process, then launched a bilingual digital application. In New Bedford, Mass., Aathira Pillai replaced giant Excel performance meetings with maps of fire incidents. The city said fires fell by more than 18% over two years. New Bedford also built a permit decision tree, a three-year data plan, an AI policy, and staff training. Source: StateTech Magazine, Oct 2, 2026. ${OCT3}.`,
        url: "https://statetechmagazine.com/article/2026/10/smart-cities-connect-2026-cities-test-small-scaling-ai-and-data-projects",
      },
      {
        title: "48 hours in Singapore without a phone",
        teaser:
          "Bloomberg CityLab's Linda Poon tried getting around Singapore for two days with no smartphone.",
        summary: `Linda Poon spent 48 hours in Singapore, which treats itself as a smart city, without a smartphone, and wrote up how she got around. The Google Alert only carried that setup, not the rest of the piece. Source: Bloomberg CityLab, Oct 2, 2026. ${OCT3}.`,
        url: "https://www.bloomberg.com/news/newsletters/2026-10-02/how-to-get-around-singapore-without-a-smartphone-citylab-weekly",
      },
    ],
  },
];
