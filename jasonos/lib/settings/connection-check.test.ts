import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getServiceDefinition,
  statusFromConnectionCheck,
  type ServiceDefinition,
} from "./services.ts";

describe("statusFromConnectionCheck", () => {
  it("marks a failed Beeper probe as an error even when a token env var exists", () => {
    const beeper = getServiceDefinition("beeper");
    assert.ok(beeper);
    const previous = process.env.BEEPER_ACCESS_TOKEN;
    process.env.BEEPER_ACCESS_TOKEN = "present";
    try {
      assert.equal(
        statusFromConnectionCheck(beeper, {
          success: false,
          health_status: "down",
        }),
        "error"
      );
    } finally {
      if (previous === undefined) delete process.env.BEEPER_ACCESS_TOKEN;
      else process.env.BEEPER_ACCESS_TOKEN = previous;
    }
  });

  it("keeps an explicit expired status", () => {
    const beeper = getServiceDefinition("beeper");
    assert.ok(beeper);
    assert.equal(
      statusFromConnectionCheck(beeper, {
        success: false,
        status: "expired",
        health_status: "down",
      }),
      "expired"
    );
  });

  it("leaves a missing env-var service as not configured", () => {
    const service = {
      name: "example",
      label: "Example",
      connectionType: "env_var",
      setup: "",
      description: "",
      features: [],
      configurable: false,
      disconnectable: false,
      envVars: ["JASONOS_DEFINITELY_UNSET_CONNECTION_CHECK"],
    } satisfies ServiceDefinition;
    assert.equal(
      statusFromConnectionCheck(service, {
        success: false,
        health_status: "down",
      }),
      "not_configured"
    );
  });

  it("keeps a passing check connected", () => {
    const beeper = getServiceDefinition("beeper");
    assert.ok(beeper);
    assert.equal(
      statusFromConnectionCheck(beeper, {
        success: true,
        health_status: "healthy",
      }),
      "connected"
    );
  });
});
