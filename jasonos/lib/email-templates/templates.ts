// Network reconnection campaign templates - starter set from
// Kuperman Outreach Templates (July 2026). Placeholders use {{key}} syntax.

export type TemplateField = {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  required: boolean;
  /** Prefill from the selected contact's first name. */
  fromContactFirstName?: boolean;
};

export type EmailTemplate = {
  id: string;
  optionNumber: number;
  title: string;
  blurb: string;
  subjectTemplate: string;
  bodyTemplate: string;
  fields: TemplateField[];
  warning?: string;
};

const NAME_FIELD: TemplateField = {
  key: "name",
  label: "First name",
  placeholder: "Alex",
  hint: "How you greet them - usually their first name.",
  required: true,
  fromContactFirstName: true,
};

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "option-01-warm-direct",
    optionNumber: 1,
    title: "Warm & Direct",
    blurb: "Best general-purpose option. Works for almost anyone on the list.",
    subjectTemplate: "A voice from the past",
    bodyTemplate: `Hi {{name}},

This is a name from a long time ago. Hope it's a welcome one.

I've been going through a bit of a reset this year. I left OUTFRONT last fall after eight years, and one of the better things about the break has been realizing how many people I genuinely liked working with and completely lost track of. You're near the top of that list.

Quick version of the last decade: after Omnicom I did a stint at a hardware/software startup, which got acquired into OUTFRONT, where I ended up running marketing and product experience through the whole digital transformation of the business. Including the New York subway, which was as complicated as it sounds.

Right now I'm doing fractional CMO work for growth-stage companies and figuring out what's next.

No agenda here beyond wanting to catch up. Would love to hear what you've been up to. Coffee, phone, whatever's easy.

All the best,
Jason`,
    fields: [NAME_FIELD],
  },
  {
    id: "option-02-honest-reconnect",
    optionNumber: 2,
    title: "Honest About the Reconnect Effort",
    blurb:
      "For people where you don't have a specific shared memory to lean on.",
    subjectTemplate: "Long overdue",
    bodyTemplate: `Hi {{name}},

I was going through my contacts recently and realized it's been well over a decade since we talked, which seems like too long.

The short version of what happened in the meantime: I spent a few years at a startup that got acquired into OUTFRONT Media, then spent eight years there leading marketing and product experience through their digital transformation. Left last fall. Currently doing fractional CMO work for growth-stage B2B companies and enjoying the freedom more than I expected to.

I've been reconnecting with people I liked working with and lost touch with, which has been one of the more rewarding parts of this whole transition.

Any chance you'd be up for a call to catch up? I'd like to hear what you're working on these days.

Best,
Jason`,
    fields: [NAME_FIELD],
  },
  {
    id: "option-03-personal-hook",
    optionNumber: 3,
    title: "Personal Hook Opener",
    blurb:
      "Highest response rate - but only if the brackets are filled with something real.",
    subjectTemplate: "Been thinking about the {{era}} days",
    bodyTemplate: `Hi {{name}},

I still think about {{memory}} more often than you'd expect.

It's been a long time. Quick catch-up on my end: post-Omnicom I joined a digital display startup, which got absorbed into OUTFRONT Media, where I stayed for eight years running marketing and product through their transition from billboards to a digital media platform. Left last fall. Now doing fractional CMO work and building a few things of my own.

Mostly writing because I've been thinking about the people I worked with back then and realized I have no idea what most of you are doing now. Would love to fix that.

Free for a call sometime in the next few weeks?

Best,
Jason`,
    fields: [
      NAME_FIELD,
      {
        key: "era",
        label: "Shared era (for the subject)",
        placeholder: "agency / Omnicom / Shanghai",
        hint: "Short phrase that goes in the subject line.",
        required: true,
      },
      {
        key: "memory",
        label: "Specific memory / project / place",
        placeholder: "that Shanghai launch week",
        hint: "Must be real - if you can't fill this honestly, use Option 01 instead.",
        required: true,
      },
    ],
    warning:
      "Do not send a generic version of this. If you can't fill the brackets honestly, use Option 01 instead.",
  },
  {
    id: "option-04-short-clean",
    optionNumber: 4,
    title: "Short & Clean",
    blurb: "When you want low friction and a fast yes.",
    subjectTemplate: "Catching up after too long",
    bodyTemplate: `Hi {{name}},

Hope this finds you well. It's been a while.

I left OUTFRONT last fall after eight years there, and I've been using the time to do two things: build a fractional CMO practice for growth-stage companies, and reconnect with people I lost track of somewhere in the last decade.

You came to mind because {{reason}}. I'd love to hear what you're working on and catch up properly.

Would a short call work sometime in the next couple weeks?

All the best,
Jason`,
    fields: [
      NAME_FIELD,
      {
        key: "reason",
        label: "Why they came to mind",
        placeholder: "shared project / something you admired / mutual connection",
        required: true,
      },
    ],
  },
  {
    id: "option-05-playful",
    optionNumber: 5,
    title: "Playful & Self-Aware",
    blurb:
      "For people you had a genuinely warm, informal relationship with.",
    subjectTemplate: "Overdue hello",
    bodyTemplate: `Hi {{name}},

Every so often I go through the mental exercise of "who did I really enjoy working with and completely fail to stay in touch with," and your name keeps coming up.

So, belatedly: hello.

I left OUTFRONT Media last fall after eight years leading marketing and product experience there. Before that, a startup that got acquired into them, and before that Omnicom in Asia. Right now I'm running a fractional CMO practice, doing advisory work with growth-stage B2B companies, and generally enjoying the fact that my calendar belongs to me for the first time in twenty years.

I'd love to hear what you've been building. Any chance you're free for a call in the next few weeks?

Best,
Jason`,
    fields: [NAME_FIELD],
  },
  {
    id: "option-06-public-success",
    optionNumber: 6,
    title: "Someone With Very Public Success",
    blurb:
      'When "so what have you been up to?" would be absurd. Acknowledge you\'ve been watching, without flattery.',
    subjectTemplate: "From the {{era}} days",
    bodyTemplate: `Hi {{name}},

I won't pretend I don't know what you've been up to; hard to miss, and it's been a pleasure to watch from a distance.

We worked together back at {{sharedContext}}, which feels like several lifetimes ago now. I'm writing because I've hit one of those moments where you take stock, and it turns out a lot of the people who shaped how I think about this business are people I haven't spoken to in over a decade.

Since then: a startup that got acquired into OUTFRONT Media, then eight years there leading marketing and product experience through their digital transformation, including the New York subway. Left last fall. Now doing fractional CMO work for growth-stage companies and building AI tooling for go-to-market work, which has been more fun than I expected.

I'm not looking for anything in particular. I'd just genuinely enjoy a conversation with you about where you think this is all heading. If you've got 30 minutes in the next month or two, I'd take it.

Either way, good to see you doing well.

Best,
Jason`,
    fields: [
      NAME_FIELD,
      {
        key: "era",
        label: "Shared era (for the subject)",
        placeholder: "TBWA / Omnicom / Shanghai",
        required: true,
      },
      {
        key: "sharedContext",
        label: "Company / project you shared",
        placeholder: "TBWA / that Omnicom pitch",
        required: true,
      },
    ],
  },
];

export const CAMPAIGN_RULES = [
  "Send no more than 5-10 per day. These people talk to each other.",
  "Personalize at least the first line of every single one.",
  "Never send Option 03 with an unfilled bracket.",
  "Log every send. Follow up once at 10-14 days, then stop.",
  "No ask in the first note. The update is the signal - the ones who can help will offer.",
] as const;

export function getEmailTemplate(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find((t) => t.id === id);
}
