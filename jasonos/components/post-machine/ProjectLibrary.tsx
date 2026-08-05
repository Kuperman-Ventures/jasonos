"use client";

import type { PostMachineProjectListItem } from "@/lib/post-machine/types";

type ProjectLibraryProps = {
  projects: PostMachineProjectListItem[];
  activeId: string | null;
  loadingId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

function formatUpdated(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const STEP_LABEL: Record<string, string> = {
  idea: "Idea",
  research: "Research",
  config: "Voice",
  hooks: "Hooks",
  output: "Output",
};

export function ProjectLibrary({
  projects,
  activeId,
  loadingId,
  onOpen,
  onDelete,
  onClose,
}: ProjectLibraryProps) {
  return (
    <section className="pm-panel pm-library">
      <div className="pm-library-head">
        <div>
          <h2 className="pm-section-title">Saved projects</h2>
          <p className="pm-section-sub" style={{ marginBottom: 0 }}>
            Open any project to resume exactly where you left off.
          </p>
        </div>
        <button type="button" className="pm-btn pm-btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      {projects.length === 0 ? (
        <p className="pm-muted-copy">No saved projects yet.</p>
      ) : (
        <ul className="pm-library-list">
          {projects.map((project) => (
            <li
              key={project.id}
              className="pm-library-item"
              data-active={project.id === activeId}
            >
              <div className="pm-library-item-main">
                <h3>{project.title}</h3>
                <p className="pm-library-preview">
                  {project.ideaPreview || project.topic || "Empty draft"}
                </p>
                <p className="pm-mono pm-library-meta">
                  {STEP_LABEL[project.step] || project.step} ·{" "}
                  {formatUpdated(project.updatedAt)}
                </p>
              </div>
              <div className="pm-library-item-actions">
                <button
                  type="button"
                  className="pm-btn"
                  onClick={() => onOpen(project.id)}
                  disabled={loadingId === project.id}
                >
                  {loadingId === project.id ? "Opening…" : "Resume"}
                </button>
                <button
                  type="button"
                  className="pm-btn pm-btn-ghost"
                  onClick={() => onDelete(project.id)}
                  disabled={loadingId === project.id}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
