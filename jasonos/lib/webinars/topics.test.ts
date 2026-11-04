import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publishSessionSchema } from "./store.ts";
import { resolveTopicAssignment, type ActiveTopic } from "./topics.ts";

const active: ActiveTopic[] = [
  { slug: "ai-search-aeo", name: "AI Search and AEO/GEO" },
  { slug: "brand-performance", name: "Brand and Performance" },
];

describe("resolveTopicAssignment", () => {
  it("rejects an unknown topic and names the active list", () => {
    assert.throws(
      () =>
        resolveTopicAssignment(
          { topic_slug: "not-a-topic", takeaways: [{}] },
          active
        ),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Unknown topic "not-a-topic"/);
        assert.match(err.message, /Active topics: ai-search-aeo, brand-performance/);
        return true;
      }
    );
  });

  it("rejects an unknown takeaway topic with the active list", () => {
    assert.throws(
      () =>
        resolveTopicAssignment(
          {
            topic_slug: "ai-search-aeo",
            takeaways: [{ topic_slug: "media-buy" }],
          },
          active
        ),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Unknown topic "media-buy"/);
        assert.match(err.message, /Active topics: ai-search-aeo, brand-performance/);
        return true;
      }
    );
  });

  it("defaults a takeaway topic to the session topic", () => {
    const result = resolveTopicAssignment(
      {
        topic_slug: "ai-search-aeo",
        takeaways: [{}, { topic_slug: "  " }, { topic_slug: "brand-performance" }],
      },
      active
    );
    assert.deepEqual(
      result.takeaways.map((takeaway) => takeaway.topic_slug),
      ["ai-search-aeo", "ai-search-aeo", "brand-performance"]
    );
    assert.equal(result.session_topic_slug, "ai-search-aeo");
    assert.equal(result.proposed, null);
  });

  it("returns a proposed topic and does not use it as the session topic", () => {
    const result = resolveTopicAssignment(
      {
        topic_slug: "ai-search-aeo",
        proposed_topic: {
          slug: "retail-media",
          name: "Retail Media",
          reason: "None of the active topics cover retail media networks.",
        },
        takeaways: [{}, { topic_slug: "brand-performance" }],
      },
      active
    );
    assert.equal(result.session_topic_slug, "ai-search-aeo");
    assert.deepEqual(
      result.takeaways.map((takeaway) => takeaway.topic_slug),
      ["ai-search-aeo", "brand-performance"]
    );
    assert.ok(!result.takeaways.some((takeaway) => takeaway.topic_slug === "retail-media"));
    assert.deepEqual(result.proposed, {
      slug: "retail-media",
      name: "Retail Media",
      status: "proposed",
      proposed_reason: "None of the active topics cover retail media networks.",
    });
  });
});

describe("takeaway lead", () => {
  const session = {
    session_key: "session-1",
    title: "A webinar",
    topic_slug: "ai-search-aeo",
  };

  it("defaults lead to an empty string and caps it at 120 characters", () => {
    const parsed = publishSessionSchema.parse({
      ...session,
      takeaways: [{ text: "The full sentence." }],
    });
    assert.equal(parsed.takeaways[0]?.lead, "");

    const capped = publishSessionSchema.parse({
      ...session,
      takeaways: [{ text: "The full sentence.", lead: "x".repeat(120) }],
    });
    assert.equal(capped.takeaways[0]?.lead.length, 120);

    assert.throws(() =>
      publishSessionSchema.parse({
        ...session,
        takeaways: [{ text: "The full sentence.", lead: "x".repeat(121) }],
      })
    );
  });
});
