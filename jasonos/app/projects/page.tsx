import { EmptyState } from "@/components/jasonos/empty-state";
import { TrackPill } from "@/components/jasonos/track-pill";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, GraduationCap, Sparkles, Target } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Project, ToDo } from "@/lib/types";

export const metadata = { title: "Projects · JasonOS" };

async function getProjectsData(): Promise<{ projects: Project[]; todos: ToDo[]; configured: boolean }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { projects: [], todos: [], configured: false };
  }

  try {
    const sb = createServiceRoleClient();
    const [{ data: projects }, { data: todos }] = await Promise.all([
      sb.from("projects").select("*").order("updated_at", { ascending: false }),
      sb.from("todos").select("*").order("due_date", { ascending: true }),
    ]);

    return {
      projects: (projects ?? []) as Project[],
      todos: (todos ?? []) as ToDo[],
      configured: true,
    };
  } catch (error) {
    console.error("[projects] Supabase query failed", error);
    return { projects: [], todos: [], configured: true };
  }
}

export default async function ProjectsPage() {
  const { projects, todos: allTodos, configured } = await getProjectsData();

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Goal → Plan decomposer output. Each project groups sequenced to-dos.
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          New project from goal
        </Button>
      </header>

      <section aria-label="Personal project tools">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Personal tools
        </div>
        <Link
          href="/projects/professor-roadmap"
          className="group flex items-start justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border bg-background">
              <GraduationCap className="h-4 w-4 text-foreground/80" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Marketing Professor Roadmap
              </h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Personal OS for the Seton Hall adjunct-first path — decisions,
                materials, outreach, gaps, and timeline in one dashboard.
              </p>
            </div>
          </div>
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            hint={
              configured
                ? "Create a project from a goal or let Tell Claude decompose a plan."
                : "Connect Supabase to load projects."
            }
            action={{ label: "Tell Claude", href: "#tell-claude" }}
            className="md:col-span-2"
          />
        ) : null}
        {projects.map((p) => {
          const todos = allTodos.filter((t) => t.project_id === p.id);
          return (
            <article
              key={p.id}
              className="jos-card-enter rounded-xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <TrackPill track={p.track} />
                  <h2 className="mt-2 text-base font-semibold tracking-tight">
                    {p.name}
                  </h2>
                </div>
                {p.target_date ? (
                  <div className="text-right text-[11px] text-muted-foreground">
                    target
                    <div className="num-mono text-foreground">
                      {format(new Date(p.target_date), "MMM d")}
                    </div>
                  </div>
                ) : null}
              </div>
              {p.goal_statement ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {p.goal_statement}
                </p>
              ) : null}

              <div className="mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Success criteria
                </div>
                <ul className="mt-1 space-y-0.5">
                  {p.success_criteria.map((s) => (
                    <li
                      key={s}
                      className="flex items-start gap-1.5 text-[12px] text-muted-foreground"
                    >
                      <Target className="mt-0.5 h-3 w-3 text-foreground/60" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 border-t pt-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Sequenced to-dos · {todos.length}
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  {todos.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2 text-[12px]"
                    >
                      <span>{t.title}</span>
                      {t.due_date ? (
                        <span className="num-mono text-[10px] text-muted-foreground">
                          {format(new Date(t.due_date), "MMM d")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {todos.length === 0 ? (
                    <li className="text-[11px] text-muted-foreground">No to-dos yet.</li>
                  ) : null}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
