export type ResumeHandoffRow = {
  gmail_account: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  resume_message_id: string | null;
  resume_filename: string | null;
  contact_name: string | null;
};

function hasResumeFile(row: ResumeHandoffRow): boolean {
  return Boolean(row.resume_filename && (row.resume_message_id || row.gmail_message_id));
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
  const linkedFile = linkedNewestFirst.find(hasResumeFile);
  if (linkedFile) return linkedFile;
  const named = sameNameWithFileNewestFirst.find(hasResumeFile);
  if (named) return named;
  return null;
}
