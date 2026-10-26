import { redirect } from "next/navigation";

export default function DecksPage() {
  redirect("/live/library?tab=decks");
}
