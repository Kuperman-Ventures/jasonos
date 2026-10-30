import { WebinarsPageClient } from "@/components/jasonos/webinars/webinars-page-client";
import { getWebinarsPage } from "@/lib/webinars/store";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Webinars · JasonOS",
  description: "Webinar sessions, takeaways, and weekly digests.",
};

export default async function WebinarsPage() {
  const { weeks } = await getWebinarsPage({ weeks: 4 });
  return <WebinarsPageClient weeks={weeks} />;
}
