-- Hash Cursor/Claude passwords already saved in Settings so the plaintext
-- does not sit in public.service_connections. Cursor still sends the original
-- password; the app hashes it before compare.

update public.service_connections
set
  config = (config - 'access_token') || jsonb_build_object(
    'access_token_hash',
    encode(sha256(convert_to(config->>'access_token', 'UTF8')), 'hex')
  ),
  updated_at = now()
where service_name = 'jasonos_mcp'
  and coalesce(config->>'access_token', '') <> ''
  and coalesce(config->>'access_token_hash', '') = '';
