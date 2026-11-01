import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickWisprHealthTool } from "./wispr-health.ts";

describe("pickWisprHealthTool", () => {
  it("prefers get_account_info when Wispr still exposes it", () => {
    assert.equal(
      pickWisprHealthTool(["search_meetings", "get_account_info", "get_meeting"]),
      "get_account_info"
    );
  });

  it("falls back to search_meetings after Wispr removed get_account_info", () => {
    assert.equal(
      pickWisprHealthTool([
        "search_meetings",
        "get_meeting",
        "get_meeting_by_calendar_id",
        "list_folders",
      ]),
      "search_meetings"
    );
  });

  it("returns null when no probe tool exists", () => {
    assert.equal(pickWisprHealthTool(["list_folders"]), null);
    assert.equal(pickWisprHealthTool([]), null);
  });
});
