import { z } from "zod";

export const Likelihood = z.enum(["high", "medium", "low"]);

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const TileSection = z.object({
  type: z.literal("tiles"),
  id: z.string(),
  heading: z.string().optional(),
  tiles: z.array(z.object({
    label: z.string(),
    value: z.string(),
    note: z.string().optional(),
    mono: z.boolean().optional(),
    size: z.enum(["large", "small"]).optional(),
  })).min(1).max(8),
});

export const TimelineSection = z.object({
  type: z.literal("timeline"),
  id: z.string(),
  heading: z.string(),
  items: z.array(z.object({
    when: z.string(),
    what: z.string(),
    why: z.string().optional(),
    date: Day.optional(),
  })).min(1).max(8),
});

export const CardsSection = z.object({
  type: z.literal("cards"),
  id: z.string(),
  heading: z.string(),
  filterBy: z.literal("likelihood").optional(),
  legend: z.string().optional(),
  cards: z.array(z.object({
    id: z.string(),
    num: z.number().optional(),
    title: z.string(),
    lead: z.string().optional(),
    likelihood: Likelihood.optional(),
    columns: z.array(z.object({
      label: z.string(),
      kind: z.enum(["list", "text", "basis"]),
      items: z.array(z.string()).optional(),
      text: z.string().optional(),
    })).min(1).max(6),
  })).min(1),
});

export const TableSection = z.object({
  type: z.literal("table"),
  id: z.string(),
  heading: z.string(),
  columns: z.array(z.string()).min(2).max(8),
  rows: z.array(z.array(z.union([
    z.string(),
    z.object({ pill: Likelihood, text: z.string() }),
  ]))).min(1),
  legend: z.string().optional(),
});

export const TextSection = z.object({
  type: z.literal("text"),
  id: z.string(),
  heading: z.string().optional(),
  paragraphs: z.array(z.string()).min(1),
});

export const NewsSection = z.object({
  type: z.literal("news"),
  id: z.string(),
  heading: z.string(),
  items: z.array(z.object({
    added: Day,
    outlet: z.string(),
    headline: z.string(),
    url: z.string().url(),
  })).min(1),
});

export const SourcesSection = z.object({
  type: z.literal("sources"),
  id: z.string(),
  heading: z.string().default("Sources"),
  items: z.array(z.object({
    title: z.string(),
    url: z.string().url().optional(),
    note: z.string().optional(),
  })).min(1),
});

export const Section = z.discriminatedUnion("type", [
  TileSection,
  TimelineSection,
  CardsSection,
  TableSection,
  TextSection,
  SourcesSection,
  NewsSection,
]);

export const DashboardHeader = z.object({
  eyebrow: z.string().optional(),
  counter: z.object({
    sectionId: z.string(),
    label: z.string(),
  }).optional(),
});

export const DashboardDocument = z.object({
  version: z.literal(1),
  title: z.string(),
  subtitle: z.string().optional(),
  updatedOn: z.string(),
  header: DashboardHeader.optional(),
  sections: z.array(Section).min(1).max(20),
});

export type DashboardDocument = z.infer<typeof DashboardDocument>;
export type Section = z.infer<typeof Section>;
export type Likelihood = z.infer<typeof Likelihood>;
