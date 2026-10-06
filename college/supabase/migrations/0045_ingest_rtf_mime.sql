-- Allow Ingest to store rich-text, email, and decks (not only PDFs).
update storage.buckets
set allowed_mime_types = (
  select array(
    select distinct unnest(
      coalesce(allowed_mime_types, '{}'::text[])
      || array[
        'application/rtf',
        'text/rtf',
        'application/x-rtf',
        'message/rfc822',
        'application/vnd.ms-outlook',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.apple.keynote'
      ]::text[]
    )
  )
)
where id = 'college-ingest';
