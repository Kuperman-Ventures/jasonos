import { redirect } from "next/navigation";
import { DARK_MATTER_ROOT } from "@/lib/dark-matter-travel-tracker/types";

export default function DarkMatterAliasPage() {
  redirect(DARK_MATTER_ROOT);
}
