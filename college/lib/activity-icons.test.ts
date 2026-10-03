import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACTIVITY_ICON_IDS,
  activityIconRequestKey,
  isActivityIconId,
  parseActivityIconReply,
  pickActivityIcon,
  resolveActivityIcon,
} from "./activity-icons";

test("allowlist ids are unique PascalCase Phosphor names", () => {
  assert.ok(ACTIVITY_ICON_IDS.length > 80);
  const seen = new Set<string>();
  for (const id of ACTIVITY_ICON_IDS) {
    assert.match(id, /^[A-Z][A-Za-z0-9]+$/);
    assert.equal(seen.has(id), false);
    seen.add(id);
    assert.equal(isActivityIconId(id), true);
  }
  assert.equal(isActivityIconId("NotAnIcon"), false);
  assert.equal(isActivityIconId(""), false);
});

test("pickActivityIcon matches common high-school names", () => {
  assert.equal(pickActivityIcon({ name: "Marching Band" }), "FlagBanner");
  assert.equal(pickActivityIcon({ name: "Robotics" }), "Robot");
  assert.equal(pickActivityIcon({ name: "Varsity Soccer" }), "SoccerBall");
  assert.equal(pickActivityIcon({ name: "Piano" }), "PianoKeys");
  assert.equal(pickActivityIcon({ name: "School Musical" }), "MaskHappy");
  assert.equal(pickActivityIcon({ name: "Debate" }), "Megaphone");
  assert.equal(pickActivityIcon({ name: "Babysitting" }), "Baby");
  assert.equal(pickActivityIcon({ name: "National Honor Society" }), "GraduationCap");
  assert.equal(pickActivityIcon({ name: "Youth Group", organization: "Temple Beth El" }), "StarOfDavid");
  assert.equal(pickActivityIcon({ name: "Taekwondo" }), "PersonSimpleThrow");
});

test("pickActivityIcon falls back to category then Sparkle", () => {
  assert.equal(pickActivityIcon({ name: "Something new", category: "research" }), "Microscope");
  assert.equal(pickActivityIcon({ name: "Something new", category: "paid-work" }), "Briefcase");
  assert.equal(pickActivityIcon({ name: "Something new" }), "Sparkle");
});

test("resolveActivityIcon keeps a stored valid icon", () => {
  assert.equal(
    resolveActivityIcon({ name: "Soccer", icon: "Guitar" }),
    "Guitar",
  );
  assert.equal(
    resolveActivityIcon({ name: "Soccer", icon: "nope" }),
    "SoccerBall",
  );
});

test("parseActivityIconReply accepts JSON, fences, and rejects unknowns", () => {
  assert.equal(parseActivityIconReply('{"icon":"Robot"}'), "Robot");
  assert.equal(parseActivityIconReply("```json\n{\"icon\":\"SoccerBall\"}\n```"), "SoccerBall");
  assert.equal(parseActivityIconReply("Robot"), "Robot");
  assert.equal(parseActivityIconReply('{"icon":"NotReal"}'), null);
  assert.equal(parseActivityIconReply("sorry"), null);
});

test("activityIconRequestKey changes when the name changes", () => {
  assert.equal(
    activityIconRequestKey({ name: "Band", category: "arts-music-theater" }),
    "Band|arts-music-theater|",
  );
  assert.notEqual(
    activityIconRequestKey({ name: "Band", category: "arts-music-theater" }),
    activityIconRequestKey({ name: "Jazz Band", category: "arts-music-theater" }),
  );
});
