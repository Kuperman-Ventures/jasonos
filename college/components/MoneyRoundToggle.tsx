"use client";

import { useSyncExternalStore } from "react";
import type { MoneyPrecision } from "@/lib/finances";

const KEY = "kyle-college-money-precision";
const EVENT = "kyle-money-precision";

function readPrecision(): MoneyPrecision {
  if (typeof window === "undefined") return "exact";
  return window.localStorage.getItem(KEY) === "thousand" ? "thousand" : "exact";
}

function subscribe(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key == null || event.key === KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onStoreChange);
  };
}

export function useMoneyPrecision(): MoneyPrecision {
  return useSyncExternalStore(subscribe, readPrecision, () => "exact");
}

export function setMoneyPrecision(next: MoneyPrecision) {
  window.localStorage.setItem(KEY, next);
  window.dispatchEvent(new window.Event(EVENT));
}

export function MoneyRoundToggle() {
  const precision = useMoneyPrecision();
  return (
    <div className="money-round" role="group" aria-label="Dollar amounts">
      <button
        type="button"
        aria-pressed={precision === "thousand"}
        onClick={() => setMoneyPrecision("thousand")}
      >
        Nearest $1,000
      </button>
      <button
        type="button"
        aria-pressed={precision === "exact"}
        onClick={() => setMoneyPrecision("exact")}
      >
        Exact
      </button>
    </div>
  );
}
