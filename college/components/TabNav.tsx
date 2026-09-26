"use client";

import { TABS, type TabId } from "@/lib/types";

export function TabNav({ tab, onChange }: { tab: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="tabs" role="tablist">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className={tab === item.id ? "active" : ""}
          aria-selected={tab === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
