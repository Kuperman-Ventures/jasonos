export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return text;
  const lower = text.toLowerCase();
  const target = needle.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  while (cursor < text.length) {
    const at = lower.indexOf(target, cursor);
    if (at < 0) {
      nodes.push(text.slice(cursor));
      break;
    }
    if (at > cursor) nodes.push(text.slice(cursor, at));
    nodes.push(
      <mark
        key={key}
        className="bg-[color-mix(in_srgb,var(--color-process-yellow)_50%,transparent)] text-[var(--jos-ink)]"
      >
        {text.slice(at, at + target.length)}
      </mark>
    );
    key += 1;
    cursor = at + Math.max(target.length, 1);
  }
  return nodes;
}
