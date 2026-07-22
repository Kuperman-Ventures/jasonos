-- Meeting Prep fields: an AI web-search brief (recent news about the person +
-- company), an "intros I want to ask for" wishlist (name + company each), and
-- free-form prep notes (prep_notes already exists).
alter table jasonos.meetings
  add column if not exists prep_research text,
  add column if not exists prep_research_at timestamptz,
  add column if not exists intro_wishlist jsonb not null default '[]'::jsonb;
