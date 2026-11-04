import {
  Briefcase,
  ChartColumn,
  Cpu,
  Handshake,
  Layers,
  Megaphone,
  MonitorPlay,
  Search,
  type LucideIcon,
} from "lucide-react";

export type TopicStyle = {
  tint: string;
  ink: string;
  icon: LucideIcon;
};

const NEUTRAL: TopicStyle = {
  tint: "#eae7e7",
  ink: "#444141",
  icon: MonitorPlay,
};

const TOPIC_STYLES: Record<string, TopicStyle> = {
  "ai-search-aeo": { tint: "#e9f8ff", ink: "#006786", icon: Search },
  "ai-operating-model": { tint: "#ece2ff", ink: "#643b9a", icon: Cpu },
  "job-search-career": { tint: "#ffe0d2", ink: "#903300", icon: Briefcase },
  "measurement-attribution": { tint: "#dae9ff", ink: "#224fa7", icon: ChartColumn },
  "brand-performance": { tint: "#ffdee6", ink: "#a3004f", icon: Megaphone },
  "advisory-practice": { tint: "#d6f0da", ink: "#085c2f", icon: Handshake },
  "product-management": {
    tint: "color-mix(in srgb, #edbb00 25%, white)",
    ink: "#5c4700",
    icon: Layers,
  },
  "media-ooh": NEUTRAL,
};

export function topicStyle(slug: string | null | undefined): TopicStyle {
  if (!slug) return NEUTRAL;
  return TOPIC_STYLES[slug] ?? NEUTRAL;
}
