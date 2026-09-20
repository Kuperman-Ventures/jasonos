"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("kyle-theme", onChange);
  return () => window.removeEventListener("kyle-theme", onChange);
}

function currentTheme() {
  const saved = window.localStorage.getItem("kyle-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light");

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("kyle-theme", next);
    window.dispatchEvent(new Event("kyle-theme"));
  }

  return (
    <button type="button" className={className ?? "btn btn-ghost no-print"} onClick={toggle}>
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}
