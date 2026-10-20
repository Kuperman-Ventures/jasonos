import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIntroReason,
  collectLinkedInUrls,
  isResumeFilename,
  pickResumeAttachment,
} from "./packet";

describe("browning packet", () => {
  it("collects LinkedIn URLs from body, reply and resume, de-duplicated", () => {
    const urls = collectLinkedInUrls([
      "See https://www.linkedin.com/in/jane-smith and https://linkedin.com/in/jane-smith/",
      "Also https://www.linkedin.com/in/other-person",
      "Resume has linkedin.com/in/jane-smith",
    ]);
    assert.deepEqual(urls, [
      "https://www.linkedin.com/in/jane-smith",
      "https://www.linkedin.com/in/other-person",
    ]);
  });

  it("identifies the resume by filename rules", () => {
    assert.equal(isResumeFilename("Jane_Smith_Resume.pdf", "Jane Smith"), true);
    assert.equal(isResumeFilename("Smith-CV.docx", "Jane Smith"), true);
    assert.equal(isResumeFilename("Smith_bio.pdf", "Jane Smith"), true);
    assert.equal(isResumeFilename("cover-letter.pdf", "Jane Smith"), false);
  });

  it("lists other documents after picking the resume", () => {
    const files = [
      { filename: "cover.pdf", bytes: Buffer.from("a"), messageId: "m1" },
      { filename: "Jane_Smith_Resume.pdf", bytes: Buffer.from("b"), messageId: "m1" },
      { filename: "portfolio.pdf", bytes: Buffer.from("c"), messageId: "m1" },
    ];
    const resume = pickResumeAttachment(files, "Jane Smith");
    assert.equal(resume?.filename, "Jane_Smith_Resume.pdf");
    const others = files.filter((file) => file !== resume);
    assert.deepEqual(
      others.map((file) => file.filename),
      ["cover.pdf", "portfolio.pdf"]
    );
  });

  it("builds intro reason from why they replied and Tracy's why", () => {
    const reason = buildIntroReason({
      name: "Jane Smith",
      whyTheyReplied: "Happy to meet Jason next week.",
      resumeText: null,
      tracyBody: `${"Thank you for your reply and interest in Executive Networking with Jason Kuperman. "}Jane led growth at Acme and would be a strong peer for Jason to compare notes with about fractional CMO work.`,
    });
    assert.ok(reason);
    assert.match(reason!, /Happy to meet Jason/);
  });
});
