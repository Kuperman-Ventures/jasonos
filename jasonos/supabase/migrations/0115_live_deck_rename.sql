-- Live taxonomy: decks.kind 'slides' → 'deck'.
set search_path = jasonos, public;

alter table jasonos.decks drop constraint if exists decks_kind_check;

update jasonos.decks
set kind = 'deck'
where kind = 'slides';

alter table jasonos.decks
  add constraint decks_kind_check check (kind in ('playbook', 'deck'));

comment on table jasonos.decks is
  'Playbooks (templates) and Decks (one meeting). kind decides which.';
