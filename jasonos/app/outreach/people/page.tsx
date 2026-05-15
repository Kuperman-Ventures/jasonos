import { getOutreachPeople } from "@/lib/outreach/data";
import { OutreachPeopleClient } from "@/components/jasonos/outreach/people-client";

export const metadata = { title: "Outreach · People" };
export const dynamic = "force-dynamic";

export default async function OutreachPeoplePage() {
  const people = await getOutreachPeople();
  return <OutreachPeopleClient people={people} />;
}
