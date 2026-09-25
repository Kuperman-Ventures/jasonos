"use client";

import { useEffect, useRef } from "react";
import { projectColor, type TodoProject } from "@/lib/todo-projects";

export function TodoMoveMenu({
  projects,
  currentProjectId,
  onPick,
  onNewProject,
  onClose,
}: {
  projects: TodoProject[];
  currentProjectId: string | null;
  onPick: (projectId: string | null) => void;
  onNewProject: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      const items = [
        ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
      ];
      if (!items.length) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items: { id: string | null; name: string; color: string | null }[] = [
    ...projects.map((project) => ({
      id: project.id,
      name: project.name,
      color: projectColor(project.colorIndex),
    })),
    { id: null, name: "No project", color: null },
  ];

  return (
    <div className="todo-move-menu" role="menu" aria-label="Move to project" ref={menuRef}>
      <span className="todo-move-label">Move to project</span>
      {items.map((item) => {
        const selected = (currentProjectId ?? null) === item.id;
        return (
          <button
            key={item.id ?? "none"}
            type="button"
            role="menuitem"
            onClick={() => onPick(item.id)}
          >
            <span
              className={item.color ? "todo-move-sq" : "todo-move-sq is-none"}
              style={item.color ? { background: item.color } : undefined}
            />
            <span className="todo-move-name">{item.name}</span>
            {selected ? <span className="todo-move-check">✓</span> : null}
          </button>
        );
      })}
      <hr />
      <button type="button" role="menuitem" className="todo-move-new" onClick={onNewProject}>
        ＋ New project…
      </button>
    </div>
  );
}
