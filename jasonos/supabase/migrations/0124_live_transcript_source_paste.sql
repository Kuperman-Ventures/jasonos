-- Allow pasted transcripts as a Live deck transcript source.
set search_path = jasonos, public;

alter table jasonos.decks
  drop constraint if exists decks_transcript_source_check;

alter table jasonos.decks
  add constraint decks_transcript_source_check
  check (transcript_source is null or transcript_source in ('granola', 'wispr', 'paste'));

comment on column jasonos.decks.transcript_source is
  'Where the stored Live transcript came from: granola, wispr, or paste.';
