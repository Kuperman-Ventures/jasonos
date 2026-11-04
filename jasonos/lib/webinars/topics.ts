/**
 * Pure topic rules for webinar publish. No database access.
 * The store loads active topics, then calls resolveTopicAssignment.
 */

export type ActiveTopic = {
  slug: string;
  name: string;
};

export type ProposedTopicDraft = {
  slug: string;
  name: string;
  reason: string;
};

export type TopicAssignmentInput = {
  topic_slug: string;
  proposed_topic?: ProposedTopicDraft | null;
  takeaways: Array<{ topic_slug?: string | null }>;
};

export type ResolvedProposedTopic = {
  slug: string;
  name: string;
  status: "proposed";
  proposed_reason: string;
};

export type ResolvedTopicAssignment = {
  session_topic_slug: string;
  takeaways: Array<{ topic_slug: string }>;
  proposed: ResolvedProposedTopic | null;
};

function activeList(activeTopics: ActiveTopic[]): string {
  return activeTopics.map((topic) => topic.slug).join(", ");
}

function unknownTopic(slug: string, activeTopics: ActiveTopic[]): Error {
  return new Error(
    `Unknown topic "${slug}". Active topics: ${activeList(activeTopics)}`
  );
}

/**
 * Session topic must be active. Each takeaway uses its own topic or the
 * session topic. A proposed topic is returned for insert and is never
 * written onto the session or the takeaways.
 */
export function resolveTopicAssignment(
  input: TopicAssignmentInput,
  activeTopics: ActiveTopic[]
): ResolvedTopicAssignment {
  const known = new Set(activeTopics.map((topic) => topic.slug));
  const sessionSlug = input.topic_slug.trim();
  if (!known.has(sessionSlug)) throw unknownTopic(sessionSlug, activeTopics);

  const takeaways = input.takeaways.map((takeaway) => {
    const raw = takeaway.topic_slug?.trim() ?? "";
    const slug = raw || sessionSlug;
    if (!known.has(slug)) throw unknownTopic(slug, activeTopics);
    return { topic_slug: slug };
  });

  const draft = input.proposed_topic;
  const proposed =
    draft && draft.slug.trim() && draft.name.trim()
      ? {
          slug: draft.slug.trim(),
          name: draft.name.trim(),
          status: "proposed" as const,
          proposed_reason: draft.reason.trim(),
        }
      : null;

  return {
    session_topic_slug: sessionSlug,
    takeaways,
    proposed,
  };
}
