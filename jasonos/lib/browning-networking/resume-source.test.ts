import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickResumeHandoff, type ResumeHandoffRow } from "./resume-source";

function row(partial: Partial<ResumeHandoffRow> & Pick<ResumeHandoffRow, "gmail_message_id">): ResumeHandoffRow {
  return {
    gmail_account: "jskuperman@gmail.com",
    gmail_thread_id: partial.gmail_message_id,
    resume_message_id: partial.gmail_message_id,
    resume_filename: null,
    contact_name: "Matt Ramerman",
    ...partial,
  };
}

describe("pickResumeHandoff", () => {
  it("uses the named resume packet when the linked intro has no file", () => {
    const intro = row({ gmail_message_id: "intro" });
    const packet = row({
      gmail_message_id: "packet",
      resume_filename: "Jason Kuperman & Matt Ramerman.docx",
    });
    const picked = pickResumeHandoff([intro], [packet]);
    assert.equal(picked?.resume_filename, "Jason Kuperman & Matt Ramerman.docx");
    assert.equal(picked?.gmail_message_id, "packet");
  });

  it("keeps the file already stored on the contact-linked handoff", () => {
    const linked = row({
      gmail_message_id: "linked",
      resume_filename: "Brad Patterson_Resume.pdf",
    });
    const other = row({
      gmail_message_id: "other",
      resume_filename: "someone-else.docx",
      contact_name: "Brad Patterson",
    });
    assert.equal(pickResumeHandoff([linked], [other])?.gmail_message_id, "linked");
  });

  it("returns null when neither row has a file", () => {
    assert.equal(pickResumeHandoff([row({ gmail_message_id: "intro" })], []), null);
  });
});
