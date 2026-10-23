"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { LeaveGuardContext } from "./leave-guard-context";

export type SaveState = "clean" | "edited" | "saving" | "failed";

export type SaveOutcome<T> = { ok: true; value?: T; savedAt?: string | null } | { ok: false; error: string };

export interface SavedFieldModel<T> {
  value: T;
  savedValue: T;
  state: SaveState;
  error: string | null;
  savedAt: string | null;
}

export type SavedFieldAction<T> =
  | { type: "edit"; value: T }
  | { type: "cancel" }
  | { type: "save" }
  | { type: "saved"; value: T; at: string | null }
  | { type: "failed"; error: string }
  | { type: "sync"; savedValue: T; savedAt: string | null };

export function sameValue<T>(a: T, b: T): boolean {
  if (typeof a === "string" && typeof b === "string") return a.trim() === b.trim();
  return JSON.stringify(a) === JSON.stringify(b);
}

export function initialModel<T>(saved: T, savedAt: string | null = null): SavedFieldModel<T> {
  return { value: saved, savedValue: saved, state: "clean", error: null, savedAt };
}

export function savedFieldReducer<T>(
  model: SavedFieldModel<T>,
  action: SavedFieldAction<T>,
  equals: (a: T, b: T) => boolean = sameValue
): SavedFieldModel<T> {
  switch (action.type) {
    case "edit": {
      if (model.state === "saving") return model;
      const clean = equals(action.value, model.savedValue);
      return { ...model, value: action.value, state: clean ? "clean" : "edited", error: null };
    }
    case "cancel":
      if (model.state === "saving") return model;
      return { ...model, value: model.savedValue, state: "clean", error: null };
    case "save":
      if (model.state !== "edited" && model.state !== "failed") return model;
      return { ...model, state: "saving", error: null };
    case "saved":
      return {
        value: action.value,
        savedValue: action.value,
        state: "clean",
        error: null,
        savedAt: action.at,
      };
    case "failed":
      return { ...model, state: "failed", error: action.error || "Could not save." };
    case "sync": {
      if (model.state === "clean") {
        return { ...model, value: action.savedValue, savedValue: action.savedValue, savedAt: action.savedAt };
      }
      return { ...model, savedValue: action.savedValue, savedAt: action.savedAt };
    }
    default:
      return model;
  }
}

/** Runs one save through the reducer: saving, then saved or failed. */
export async function runSave<T>(
  value: T,
  onSave: (value: T) => Promise<SaveOutcome<T>>,
  dispatch: (action: SavedFieldAction<T>) => void,
  now: () => string = () => new Date().toISOString()
): Promise<boolean> {
  dispatch({ type: "save" });
  try {
    const result = await onSave(value);
    if (result.ok) {
      dispatch({ type: "saved", value: result.value ?? value, at: result.savedAt ?? now() });
      return true;
    }
    dispatch({ type: "failed", error: result.error });
    return false;
  } catch (err) {
    dispatch({ type: "failed", error: err instanceof Error ? err.message : "Could not save." });
    return false;
  }
}

export function isSaveShortcut(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey">): boolean {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

export interface SavedField<T> {
  value: T;
  savedValue: T;
  state: SaveState;
  error: string | null;
  savedAt: string | null;
  dirty: boolean;
  setValue: (value: T) => void;
  save: () => Promise<boolean>;
  cancel: () => void;
  /** Attach to the field (or a wrapper): ⌘Enter / Ctrl+Enter saves, Esc cancels. */
  onKeyDown: (event: KeyboardEvent) => void;
}

/**
 * One saved field. No autosave: edits stay local until Save or ⌘Enter.
 * When `saved` changes on the server and the field is clean, the field adopts it.
 */
export function useSavedField<T>({
  saved,
  savedAt = null,
  onSave,
  label,
  equals = sameValue,
}: {
  saved: T;
  savedAt?: string | null;
  onSave: (value: T) => Promise<SaveOutcome<T>>;
  /** Names the field in the leave guard and in Ready messages ("Why"). */
  label: string;
  equals?: (a: T, b: T) => boolean;
}): SavedField<T> {
  const [model, setModel] = useState(() => initialModel(saved, savedAt));
  const [seen, setSeen] = useState(() => ({ saved, savedAt }));
  if (!equals(seen.saved, saved) || seen.savedAt !== savedAt) {
    setSeen({ saved, savedAt });
    setModel((current) => savedFieldReducer(current, { type: "sync", savedValue: saved, savedAt }, equals));
  }

  const modelRef = useRef(model);
  const onSaveRef = useRef(onSave);
  const equalsRef = useRef(equals);
  useLayoutEffect(() => {
    modelRef.current = model;
    onSaveRef.current = onSave;
    equalsRef.current = equals;
  });

  const dispatch = useCallback((action: SavedFieldAction<T>) => {
    setModel((current) => savedFieldReducer(current, action, equalsRef.current));
  }, []);

  const inFlight = useRef(false);
  const save = useCallback(async () => {
    const current = modelRef.current;
    if (inFlight.current) return false;
    if (current.state !== "edited" && current.state !== "failed") return current.state === "clean";
    inFlight.current = true;
    try {
      return await runSave(current.value, (value) => onSaveRef.current(value), dispatch);
    } finally {
      inFlight.current = false;
    }
  }, [dispatch]);

  const cancel = useCallback(() => dispatch({ type: "cancel" }), [dispatch]);
  const setValue = useCallback((value: T) => dispatch({ type: "edit", value }), [dispatch]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isSaveShortcut(event)) {
        event.preventDefault();
        void save();
      } else if (event.key === "Escape" && modelRef.current.state !== "clean") {
        event.preventDefault();
        cancel();
      }
    },
    [save, cancel]
  );

  const dirty = model.state === "edited" || model.state === "failed" || model.state === "saving";
  const guard = useContext(LeaveGuardContext);
  const id = useId();
  useEffect(() => {
    if (!guard) return;
    guard.report(id, { label, dirty, save, cancel });
  }, [guard, id, label, dirty, save, cancel]);
  useEffect(() => {
    if (!guard) return;
    return () => guard.forget(id);
  }, [guard, id]);

  return {
    value: model.value,
    savedValue: model.savedValue,
    state: model.state,
    error: model.error,
    savedAt: model.savedAt,
    dirty,
    setValue,
    save,
    cancel,
    onKeyDown,
  };
}
