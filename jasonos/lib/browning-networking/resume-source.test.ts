import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasResumeFile,
  pickResumeHandoff,
  resumeAttachmentLabel,
  type ResumeHandoffRow,
} from "./resume-source";

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

describe("hasResumeFile", () => {
  it("is true when a filename is stored with a message id", () => {
    assert.equal(
      hasResumeFile(
        row({
          gmail_message_id: "m1",
          resume_filename: "Jason Kuperman & Matt Ramerman.docx",
        })
      ),
      true
    );
  });

  it("is true when only a resume message or thread pointer exists", () => {
    assert.equal(
      hasResumeFile(
        row({
          gmail_message_id: "intro",
          resume_filename: null,
          resume_message_id: "packet",
          gmail_thread_id: null,
        })
      ),
      true
    );
    assert.equal(
      hasResumeFile(
        row({
          gmail_message_id: "intro",
          resume_filename: null,
          resume_message_id: null,
          gmail_thread_id: "thread-1",
        })
      ),
      true
    );
  });

  it("is false with no filename and no message/thread pointer", () => {
    assert.equal(
      hasResumeFile(
        row({
          gmail_message_id: "intro",
          resume_filename: null,
          resume_message_id: null,
          gmail_thread_id: null,
        })
      ),
      false
    );
  });
});

describe("pickResumeHandoff", () => {
  it("uses the named resume packet when the linked intro has no file", () => {
    const intro = row({
      gmail_message_id: "intro",
      resume_message_id: null,
      gmail_thread_id: null,
    });
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

  it("uses the linked intro thread when filename is not stored yet", () => {
    const intro = row({
      gmail_message_id: "intro",
      resume_filename: null,
      resume_message_id: null,
      gmail_thread_id: "thread-1",
    });
    assert.equal(pickResumeHandoff([intro], [])?.gmail_thread_id, "thread-1");
  });

  it("returns null when neither row has a file pointer", () => {
    assert.equal(
      pickResumeHandoff(
        [
          row({
            gmail_message_id: "intro",
            resume_message_id: null,
            gmail_thread_id: null,
          }),
        ],
        []
      ),
      null
    );
  });
});

describe("resumeAttachmentLabel", () => {
  it("uses the stored filename when present", () => {
    assert.equal(resumeAttachmentLabel("Brad.pdf"), "Brad.pdf");
  });

  it("falls back when Tracy's Word/PDF filename was never stored", () => {
    assert.equal(resumeAttachmentLabel(null), "Attached resume (Word or PDF)");
    assert.equal(resumeAttachmentLabel("  "), "Attached resume (Word or PDF)");
  });
});
