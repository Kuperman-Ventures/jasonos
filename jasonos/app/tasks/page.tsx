import { getTasks } from "@/lib/server-actions/tasks";
import { TaskLibraryClient } from "@/components/jasonos/tasks/task-library-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Task Library · JasonOS" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ selected?: string }>;
}) {
  const tasks = await getTasks();
  const { selected } = await searchParams;

  return (
    <div className="h-[calc(100vh-3rem)]">
      <TaskLibraryClient tasks={tasks} initialSelectedId={selected ?? null} />
    </div>
  );
}
