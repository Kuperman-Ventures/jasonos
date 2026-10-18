import { ArrowUpRight } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";

type ProjectLinkRow = {
  id: string;
  title: string;
  url: string;
  description: string | null;
};

function safeHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function loadProjectLinks(slug: string): Promise<ProjectLinkRow[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("project_links")
    .select("id, title, url, kind, description, sort_order")
    .eq("project_slug", slug)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectLinkRow[];
}

export async function ProjectLinks({ slug }: { slug: string }) {
  const links = await loadProjectLinks(slug);

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Plans and Artifacts
      </h2>
      {links.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Nothing filed yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {links.map((link) => {
            const href = safeHttpUrl(link.url);
            const body = (
              <>
                <div className="min-w-0">
                  <div className="text-sm font-semibold tracking-tight">{link.title}</div>
                  {link.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {link.description}
                    </p>
                  ) : null}
                </div>
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </>
            );

            return (
              <li key={link.id}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start justify-between gap-3"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="flex items-start justify-between gap-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
