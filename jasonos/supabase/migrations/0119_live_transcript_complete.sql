-- Live review accuracy: full transcript completeness + Advisors Intro rubric + rubric source.
set search_path = jasonos, public;

alter table jasonos.decks
  add column if not exists transcript_chars integer,
  add column if not exists transcript_complete boolean,
  add column if not exists rubric_source text;

comment on column jasonos.decks.transcript_chars is
  'Character length of the stored transcript at fetch time.';
comment on column jasonos.decks.transcript_complete is
  'False when the stored transcript still contains a paging marker or the fetch stopped at a page/char cap.';
comment on column jasonos.decks.rubric_source is
  'Where the rubric came from: default, a playbook name, or custom after edit.';

-- Backfill lengths and mark truncated Wispr pages incomplete.
update jasonos.decks
set
  transcript_chars = length(transcript),
  transcript_complete = case
    when transcript like '%(...truncated%view_transcript.start_char=%' then false
    else transcript_complete
  end
where transcript is not null
  and transcript <> '';

update jasonos.decks
set transcript_complete = false
where transcript is not null
  and transcript like '%(...truncated%view_transcript.start_char=%';

-- Seed Advisors Intro playbook rubric (client / advisor discovery, not Browning networking).
update jasonos.decks
set
  rubric = '[
    "Set expectations in the first two minutes: the time, why we are talking, and what I would propose by the end.",
    "Asked what they are building and what they need before explaining what I do.",
    "They spoke more than I did.",
    "Learned where their revenue comes from and what a good year looks like.",
    "Learned what is ending, changing, or missing in their current setup.",
    "Gave my background in under 60 seconds.",
    "Named the one way I can help, in a sentence they could repeat.",
    "Put a proposal on the table with a scope, a duration, and a price band.",
    "Asked which part they would cut and what is missing.",
    "Named every commitment I made and when they will get it.",
    "Closed with a dated next step on both calendars."
  ]'::jsonb,
  rubric_source = 'Advisors Intro',
  updated_at = now()
where kind = 'playbook'
  and name = 'Advisors Intro';

-- Decks cloned from Advisors Intro that still carry the Browning default get the Advisors rubric.
update jasonos.decks d
set
  rubric = p.rubric,
  rubric_source = 'Advisors Intro',
  updated_at = now()
from jasonos.decks p
where p.id = d.source_playbook_id
  and p.kind = 'playbook'
  and p.name = 'Advisors Intro'
  and d.kind = 'deck'
  and d.rubric = (select rubric from jasonos.live_defaults where id = true);

-- Label default Browning rubrics.
update jasonos.decks d
set rubric_source = 'default'
where d.rubric_source is null
  and d.rubric = (select rubric from jasonos.live_defaults where id = true);

update jasonos.decks
set rubric_source = 'Advisors Intro'
where kind = 'playbook'
  and name = 'Advisors Intro'
  and (rubric_source is null or rubric_source = 'default');
