import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCapturePrompt } from "./capture-prompt.ts";

describe("buildCapturePrompt", () => {
  it("includes the screen id and the LinkedIn URL", () => {
    const prompt = buildCapturePrompt({
      screenId: "6f1c0c3e-1b2a-4d5e-8f90-aabbccddeeff",
      connectorName: "Ada Lovelace",
      connectorLinkedinUrl: "https://www.linkedin.com/in/ada",
    });
    assert.match(prompt, /6f1c0c3e-1b2a-4d5e-8f90-aabbccddeeff/);
    assert.match(prompt, /https:\/\/www\.linkedin\.com\/in\/ada/);
    assert.match(prompt, /import_network_screen/);
  });
});
