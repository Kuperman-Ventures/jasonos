import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_COLLEGE_AI_MODEL,
  FREE_FALLBACK_COLLEGE_AI_MODEL,
  collegeAiModelId,
  formatGatewayAccessError,
  isGatewayModelAccessError,
} from "./ai-model";

test("collegeAiModelId defaults to free-tier Gemini Flash", () => {
  const prev = {
    EXTRACTION_MODEL: process.env.EXTRACTION_MODEL,
    COLLEGE_AI_MODEL: process.env.COLLEGE_AI_MODEL,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  };
  delete process.env.EXTRACTION_MODEL;
  delete process.env.COLLEGE_AI_MODEL;
  delete process.env.ANTHROPIC_MODEL;
  try {
    assert.equal(collegeAiModelId(), DEFAULT_COLLEGE_AI_MODEL);
    assert.equal(collegeAiModelId("  anthropic/claude-sonnet-4.6  "), "anthropic/claude-sonnet-4.6");
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("isGatewayModelAccessError detects free-tier and credit messages", () => {
  assert.equal(
    isGatewayModelAccessError(
      "Free tier users do not have access to this model. Upgrade to paid credits at https://vercel.com/...",
    ),
    true,
  );
  assert.equal(isGatewayModelAccessError("Could not parse JSON"), false);
  assert.equal(FREE_FALLBACK_COLLEGE_AI_MODEL.includes("free"), true);
});

test("formatGatewayAccessError rewrites free-tier failures", () => {
  const msg = formatGatewayAccessError(
    "Free tier users do not have access to this model. Upgrade to paid credits.",
  );
  assert.match(msg, /paid Vercel AI Gateway credits/i);
  assert.match(msg, /EXTRACTION_MODEL=/);
});
