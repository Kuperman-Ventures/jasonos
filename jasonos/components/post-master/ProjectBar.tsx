"use client";

type ProjectBarProps = {
  title: string;
  onTitleChange: (title: string) => void;
  projectId: string | null;
  saving: boolean;
  saveMessage: string | null;
  onSave: () => void;
  onOpenLibrary: () => void;
  onNew: () => void;
  canSave: boolean;
};

export function ProjectBar({
  title,
  onTitleChange,
  projectId,
  saving,
  saveMessage,
  onSave,
  onOpenLibrary,
  onNew,
  canSave,
}: ProjectBarProps) {
  return (
    <div className="pm-project-bar">
      <div className="pm-project-title-wrap">
        <label className="pm-label" htmlFor="pm-project-title">
          Project title
        </label>
        <input
          id="pm-project-title"
          className="pm-input"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled post"
        />
        <p className="pm-project-meta pm-mono">
          {projectId ? "Saved project" : "Unsaved draft"}
          {saveMessage ? ` · ${saveMessage}` : ""}
        </p>
      </div>

      <div className="pm-project-actions">
        <button
          type="button"
          className="pm-btn pm-btn-ghost"
          onClick={onOpenLibrary}
        >
          Open
        </button>
        <button
          type="button"
          className="pm-btn pm-btn-ghost"
          onClick={onNew}
        >
          New
        </button>
        <button
          type="button"
          className="pm-btn"
          onClick={onSave}
          disabled={saving || !canSave}
        >
          {saving ? "Saving…" : projectId ? "Save" : "Save project"}
        </button>
      </div>
    </div>
  );
}
