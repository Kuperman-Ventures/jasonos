export type ResumeHandoffRow = {
  gmail_account: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  resume_message_id: string | null;
  resume_filename: string | null;
  contact_name: string | null;
};

/** True when we can open a Word/PDF from this handoff (filename optional). */
export function hasResumeFile(row: ResumeHandoffRow): boolean {
  if (row.resume_filename?.trim() && (row.resume_message_id || row.gmail_message_id)) {
    return true;
  }
  // Filename may not be stored yet; download still scans the resume message
  // or the Gmail thread for .docx / .doc / .pdf attachments.
  return Boolean(row.resume_message_id?.trim() || row.gmail_thread_id?.trim());
}

/**
 * Tracy sends the intro and the resume as two emails. The intro row is the one
 * linked to the contact. The file often lives on the other row, matched by name.
 * Prefer a contact-linked row that already has the file.
 */
export function pickResumeHandoff(
  linkedNewestFirst: ResumeHandoffRow[],
  sameNameWithFileNewestFirst: ResumeHandoffRow[]
): ResumeHandoffRow | null {
  const linkedFile =
    linkedNewestFirst.find((row) => Boolean(row.resume_filename?.trim())) ||
    linkedNewestFirst.find(hasResumeFile);
  if (linkedFile) return linkedFile;
  const named =
    sameNameWithFileNewestFirst.find((row) => Boolean(row.resume_filename?.trim())) ||
    sameNameWithFileNewestFirst.find(hasResumeFile);
  if (named) return named;
  return null;
}

export function resumeAttachmentLabel(filename: string | null | undefined): string {
  const name = filename?.trim();
  if (name) return name;
  return "Attached resume (Word or PDF)";
}
