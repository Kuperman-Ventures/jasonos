import { FamilyMeetingAgendaView } from "@/components/jasonos/family-meeting/agenda-view";
import { ProjectLinks } from "@/components/jasonos/project-links";
import { loadFamilyMeetingAgenda } from "@/lib/family-meeting/agenda";
import { toClientFamilyMeetingAgenda } from "@/lib/family-meeting/types";
import {
  getLatestPrintPack,
  listArchivedSeries,
  listHiddenOccurrences,
} from "@/lib/family-meeting/store";

export const metadata = {
  title: "Family Meeting · JasonOS",
  description:
    "Edit the two-week Family Meeting board — hide, archive, heads-up, and Friday print packs.",
};

export const dynamic = "force-dynamic";

export default async function FamilyMeetingPage() {
  const agenda = toClientFamilyMeetingAgenda(await loadFamilyMeetingAgenda());

  let hiddenEdits: Awaited<ReturnType<typeof listHiddenOccurrences>> = [];
  let archivedSeries: Awaited<ReturnType<typeof listArchivedSeries>> = [];
  let latestPrintPath: string | null = null;
  try {
    const [hidden, archived, pack] = await Promise.all([
      listHiddenOccurrences(),
      listArchivedSeries(),
      getLatestPrintPack(),
    ]);
    hiddenEdits = hidden;
    archivedSeries = archived;
    if (pack) latestPrintPath = `/projects/family-meeting/print/${pack.id}`;
  } catch (error) {
    console.error("[family-meeting.undo]", error);
  }

  return (
    <>
      <FamilyMeetingAgendaView
        agenda={agenda}
        hiddenEdits={hiddenEdits}
        archivedSeries={archivedSeries}
        latestPrintPath={latestPrintPath}
      />
      <div className="mx-auto max-w-[1120px] px-4 pb-8">
        <ProjectLinks slug="family-meeting" />
      </div>
    </>
  );
}
