type TransitionBlockProps = {
  paragraphs: readonly string[];
};

/**
 * Quiet transition copy above a chapter's primary continue CTA.
 * No heading, icon, or border — only a violet left rule.
 */
export function TransitionBlock({ paragraphs }: TransitionBlockProps) {
  if (paragraphs.length === 0) return null;

  return (
    <div className="iugr-transition">
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}
