import { redirect } from "next/navigation";

export default function PlaybooksPage() {
  redirect("/live/library?tab=playbooks");
}
