"use client";

import { createContext } from "react";

export interface GuardedField {
  label: string;
  dirty: boolean;
  save: () => Promise<boolean>;
  cancel: () => void;
}

export interface LeaveGuardValue {
  report: (id: string, field: GuardedField) => void;
  forget: (id: string) => void;
}

export const LeaveGuardContext = createContext<LeaveGuardValue | null>(null);
