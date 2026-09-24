import { redirect } from "next/navigation";
import { Portal } from "@/components/Portal";
import { authConfigured, getCollegeSession } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/db";

export default async function HomePage() {
  if (supabaseConfigured() && authConfigured()) {
    const session = await getCollegeSession();
    if (!session) redirect("/login");
    return (
      <Portal
        member={{
          id: session.member.id,
          displayName: session.member.displayName,
          role: session.member.role,
          email: session.email,
        }}
      />
    );
  }

  return (
    <Portal
      member={{
        id: "local",
        displayName: "Local",
        role: "super_admin",
        email: "",
      }}
    />
  );
}
