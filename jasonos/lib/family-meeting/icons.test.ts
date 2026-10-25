import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  discernEventIcon,
  locationForDisplay,
  resolveEventIcon,
} from "./icons.ts";

describe("discernEventIcon", () => {
  it("maps obvious titles", () => {
    assert.equal(discernEventIcon("Train to Grand Central"), "train");
    assert.equal(discernEventIcon("Lucien’s Birthday"), "cake");
    assert.equal(discernEventIcon("Dad Vacuums 1st & 2nd Floor"), "vacuum");
    assert.equal(discernEventIcon("Composting pick-up"), "recycle");
    assert.equal(discernEventIcon("Kuperman Family Playlist (1 Song!)"), "music");
    assert.equal(discernEventIcon("Change cats water"), "cat");
    assert.equal(discernEventIcon("Soccer practice"), "sport");
    assert.equal(discernEventIcon("Flight to Chicago"), "plane");
  });

  it("uses a video icon for Webex / Zoom / webinar locations", () => {
    assert.equal(
      discernEventIcon(
        "Using Psychology to Help Your Student Be a Competent Cougar",
        "https://somsdk12.webex.com/wbxmjs/joinservice/sites/somsdk12/meeting"
      ),
      "video"
    );
    assert.equal(
      discernEventIcon("Team sync", "https://us02web.zoom.us/j/12345"),
      "video"
    );
    assert.equal(discernEventIcon("Parent webinar tonight"), "video");
  });

  it("falls back when nothing matches", () => {
    assert.equal(discernEventIcon("Mystery hang"), "star");
  });
});

describe("resolveEventIcon", () => {
  it("prefers a persisted override over keyword discern", () => {
    assert.equal(
      resolveEventIcon({ title: "Flight to Chicago", iconId: "cake" }),
      "cake"
    );
    assert.equal(
      resolveEventIcon({ title: "Flight to Chicago", iconId: null }),
      "plane"
    );
  });
});

describe("locationForDisplay", () => {
  it("hides URLs and meeting join links", () => {
    assert.equal(
      locationForDisplay(
        "https://somsdk12.webex.com/wbxmjs/joinservice/sites/somsdk12/meeting"
      ),
      null
    );
    assert.equal(locationForDisplay("Springfield MVC Vehicle Center"), "Springfield MVC Vehicle Center");
  });
});
