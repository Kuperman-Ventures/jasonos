import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WISPR_TRANSCRIPT_MAX_PAGES,
  fetchWisprTranscriptPages,
  joinWisprTranscriptPages,
  stripPagingMarker,
  transcriptHasPagingMarker,
} from "./wispr-transcript.ts";

const marker = (remaining: number, start: number) =>
  `(...truncated, ${remaining} chars remaining; continue with view_transcript.start_char=${start}...)`;

describe("wispr transcript paging", () => {
  it("detects the Wispr paging marker even with a trailing wrapper", () => {
    const text = `Speaker 1: hello\n${marker(7044, 12000)}\n<<<END TRANSCRIPT>>>`;
    assert.equal(transcriptHasPagingMarker(text), true);
    const stripped = stripPagingMarker(text);
    assert.equal(stripped.text, "Speaker 1: hello");
    assert.equal(stripped.nextStart, 12000);
    assert.equal(stripped.remaining, 7044);
  });

  it("joins three pages into one transcript with no marker", () => {
    const pages = [
      `page one text\n${marker(100, 20)}`,
      `page two text\n${marker(50, 40)}`,
      "page three text",
    ];
    const joined = joinWisprTranscriptPages(pages);
    assert.equal(joined.complete, true);
    assert.equal(joined.text, "page one text\npage two text\npage three text");
    assert.equal(transcriptHasPagingMarker(joined.text), false);
  });

  it("marks incomplete when the last page still has a marker", () => {
    const pages = [`only page\n${marker(10, 100)}`];
    const joined = joinWisprTranscriptPages(pages);
    assert.equal(joined.complete, false);
    assert.equal(joined.text, "only page");
  });

  it("fetchWisprTranscriptPages pages via mocked get_meeting", async () => {
    const responses = [
      {
        text: `AAAA\n${marker(8, 4)}`,
        json: { transcript: `AAAA\n${marker(8, 4)}` },
        isError: false,
      },
      {
        text: `BBBB\n${marker(4, 8)}`,
        json: { transcript: `BBBB\n${marker(4, 8)}` },
        isError: false,
      },
      {
        text: "CCCC",
        json: { transcript: "CCCC" },
        isError: false,
      },
    ];
    let calls = 0;
    const result = await fetchWisprTranscriptPages("meeting-1", async (name, args) => {
      assert.equal(name, "get_meeting");
      assert.equal(args.meeting_id, "meeting-1");
      const start = (args.view_transcript as { start_char?: number }).start_char;
      assert.equal(start, calls === 0 ? 0 : calls === 1 ? 4 : 8);
      const response = responses[calls]!;
      calls += 1;
      return response;
    });
    assert.equal(calls, 3);
    assert.equal(result.complete, true);
    assert.equal(result.text, "AAAA\nBBBB\nCCCC");
    assert.ok(calls <= WISPR_TRANSCRIPT_MAX_PAGES);
  });
});
