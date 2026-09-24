import assert from "node:assert/strict";
import test from "node:test";
import { isSuperAdmin, type CollegeSession } from "./auth";

test("super admin is Jason's role", () => {
  const session: CollegeSession = {
    userId: "u1",
    email: "jason@kupermanadvisors.com",
    member: {
      id: "jason",
      email: "jason@kupermanadvisors.com",
      displayName: "Jason",
      role: "super_admin",
      uiVisible: true,
      authUserId: "u1",
    },
  };
  assert.equal(isSuperAdmin(session), true);
});

test("student is not super admin", () => {
  const session: CollegeSession = {
    userId: "u2",
    email: "kyle@example.com",
    member: {
      id: "kyle",
      email: "kyle@example.com",
      displayName: "Kyle",
      role: "student",
      uiVisible: true,
      authUserId: "u2",
    },
  };
  assert.equal(isSuperAdmin(session), false);
});
