import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractLeadDeltaPhotoUrl,
  firstConnectionFromMcp,
  normalizeLeadDeltaConnection,
  normalizeLinkedInUrl,
} from "./leaddelta-parse.ts";

describe("normalizeLinkedInUrl", () => {
  it("normalizes profile links and rejects non-profile URLs", () => {
    assert.equal(
      normalizeLinkedInUrl("https://www.linkedin.com/in/mbd74/"),
      "https://www.linkedin.com/in/mbd74"
    );
    assert.equal(
      normalizeLinkedInUrl("linkedin.com/in/Some-Person"),
      "https://www.linkedin.com/in/Some-Person"
    );
    assert.equal(
      normalizeLinkedInUrl("https://www.linkedin.com/company/acme"),
      null
    );
  });
});

describe("extractLeadDeltaPhotoUrl", () => {
  it("finds nested photo fields", () => {
    assert.equal(
      extractLeadDeltaPhotoUrl({
        profile: { profilePicture: "https://media.licdn.com/dms/image/C1.jpg" },
      }),
      "https://media.licdn.com/dms/image/C1.jpg"
    );
    assert.equal(
      extractLeadDeltaPhotoUrl({ avatarUrl: "https://cdn.example.com/a.png" }),
      "https://cdn.example.com/a.png"
    );
    assert.equal(extractLeadDeltaPhotoUrl({ image: "/local.png" }), null);
  });
});

describe("normalizeLeadDeltaConnection", () => {
  it("maps common LeadDelta shapes", () => {
    const connection = normalizeLeadDeltaConnection({
      id: "ld_1",
      firstName: "Ada",
      lastName: "Lovelace",
      headline: "Mathematician",
      companyName: "Analytical Engines",
      linkedinUrl: "https://www.linkedin.com/in/ada",
      profilePictureUrl: "https://cdn.example.com/ada.jpg",
      emails: ["ada@example.com"],
    });
    assert.equal(connection?.fullName, "Ada Lovelace");
    assert.equal(connection?.company, "Analytical Engines");
    assert.equal(connection?.photoUrl, "https://cdn.example.com/ada.jpg");
    assert.deepEqual(connection?.emails, ["ada@example.com"]);
  });

  it("maps get_connection profilePicture + publicIdentifier", () => {
    const connection = firstConnectionFromMcp({
      connection: {
        id: "692f717613175fe9e500de02",
        name: "John Tilbury",
        firstName: "John",
        lastName: "Tilbury",
        publicIdentifier: "johntilbury",
        profilePicture:
          "https://media.licdn.com/dms/image/v2/D5603AQFuiZxBpOCD2Q/profile-displayphoto-scale_400_400/B56Z.jpg",
      },
    });
    assert.equal(connection?.fullName, "John Tilbury");
    assert.equal(
      connection?.linkedinUrl,
      "https://www.linkedin.com/in/johntilbury"
    );
    assert.equal(
      connection?.photoUrl,
      "https://media.licdn.com/dms/image/v2/D5603AQFuiZxBpOCD2Q/profile-displayphoto-scale_400_400/B56Z.jpg"
    );
  });
});
