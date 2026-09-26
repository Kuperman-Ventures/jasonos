"use client";

import { useEffect, useRef } from "react";
import {
  TODO_PROJECT_COLORS,
  TODO_PROJECT_NAME_MAX,
  normalizeProjectName,
  type TodoProject,
} from "@/lib/todo-projects";

export type ProjectEditorState = {
  mode: "new" | "edit";
  projectId: string | null;
  draft: string;
  colorIndex: number;
  /** To-do ids that will move into a new project on Create. */
  moveTodoIds: string[];
  confirmDelete: boolean;
};

export function TodoProjectEditor({
  state,
  projects,
  todoCount,
  onChange,
  onSave,
  onCancel,
  onAskDelete,
  onConfirmDelete,
}: {
  state: ProjectEditorState;
  projects: TodoProject[];
  todoCount: number;
  onChange: (patch: Partial<ProjectEditorState>) => void;
  onSave: () => void;
  onCancel: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isNew = state.mode === "new";
  const project = projects.find((row) => row.id === state.projectId) ?? null;
  const moveCount = state.moveTodoIds.length;

  useEffect(() => {
    const input = inputRef.current;
    if (!input || state.confirmDelete) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [state.confirmDelete, state.mode, state.projectId]);

  if (state.confirmDelete && project) {
    return (
      <div className="todo-project-editor">
        <span className="todo-project-editor-kick">Delete project</span>
        <div className="todo-project-editor-row">
          <p className="todo-project-confirm">
            Delete “{project.name}”?{" "}
            {todoCount
              ? `Its ${todoCount} to-do${todoCount === 1 ? "" : "s"} stay on the list with no project.`
              : "It has no to-dos."}
          </p>
          <button type="button" className="btn btn-danger" onClick={onConfirmDelete}>
            Delete project
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Keep it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="todo-project-editor">
      <span className="todo-project-editor-kick">
        {isNew ? "New project" : "Edit project"}
        {isNew && moveCount ? (
          <small>
            {moveCount} to-do{moveCount === 1 ? "" : "s"} will move into it
          </small>
        ) : null}
      </span>
      <div className="todo-project-editor-row">
        <input
          ref={inputRef}
          className="field"
          value={state.draft}
          maxLength={TODO_PROJECT_NAME_MAX}
          placeholder="Project name"
          aria-label="Project name"
          onChange={(event) => onChange({ draft: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (normalizeProjectName(state.draft)) onSave();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        <div className="todo-project-hues" role="radiogroup" aria-label="Color">
          {TODO_PROJECT_COLORS.map((color, index) => (
            <button
              key={color}
              type="button"
              className="todo-project-hue"
              role="radio"
              aria-checked={index === state.colorIndex}
              aria-label={`Color ${index + 1}`}
              style={{ background: color }}
              onClick={() => onChange({ colorIndex: index })}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn btn-dark"
          disabled={!normalizeProjectName(state.draft)}
          onClick={onSave}
        >
          {isNew ? "Create" : "Save"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        {!isNew ? (
          <button type="button" className="btn todo-project-del" onClick={onAskDelete}>
            Delete project
          </button>
        ) : null}
      </div>
    </div>
  );
}
