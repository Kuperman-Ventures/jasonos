import { FamilyMeetingAgendaView } from "@/components/jasonos/family-meeting/agenda-view";
import { ProjectLinks } from "@/components/jasonos/project-links";
import { loadFamilyMeetingAgenda } from "@/lib/family-meeting/agenda";

export const metadata = {
  title: "Family Meeting · JasonOS",
  description:
    "Edit the two-week Family Meeting board from Kuperman Family, Kat & Jason, Kyle, and Wyatt calendars — hide, archive, promote/demote, and print four sheets.",
}

export const dynamic = "force-dynamic";

export default async function FamilyMeetingPage() {
  const agenda = await loadFamilyMeetingAgenda();

  return (
    <>
      <FamilyMeetingAgendaView agenda={agenda} />
      <div className="mx-auto max-w-[1120px] px-4 pb-8">
        <ProjectLinks slug="family-meeting" />
      </div>
    </>
  );
}
