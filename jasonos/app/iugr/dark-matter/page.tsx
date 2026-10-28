import { DarkMatterExplainer } from "@/components/dark-matter/explainer";
import { FieldNoteLibrary } from "@/components/iugr/FieldNoteLibrary";
import { DARK_MATTER_ENTRY_ID } from "@/lib/dark-matter-travel-tracker/types";
import { SERIES } from "@/lib/iugr/copy";
import Link from "next/link";

export default function DarkMatterIugrPage() {
  return (
    <div className="dm-explainer">
      <div className="dm-shell">
        <p className="dm-iugr-kicker">
          <Link href="/iugr">{SERIES.shortName}</Link>
          <span>Entry 02 · Live</span>
          <span>{SERIES.name}</span>
        </p>
        <DarkMatterExplainer />
        <FieldNoteLibrary currentId={DARK_MATTER_ENTRY_ID} />
      </div>
    </div>
  );
}
