"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Likelihood } from "@/lib/dashboard/schema";

export type DashboardFilter = "all" | Likelihood;

type FilterState = {
  sectionId?: string;
  filter: DashboardFilter;
  setFilter: (filter: DashboardFilter) => void;
};

const FilterContext = createContext<FilterState | null>(null);

export function DashboardFilterProvider({
  sectionId,
  children,
}: {
  sectionId?: string;
  children: ReactNode;
}) {
  const [filter, setFilter] = useState<DashboardFilter>("all");
  return <FilterContext.Provider value={{ sectionId, filter, setFilter }}>{children}</FilterContext.Provider>;
}

export function useDashboardFilter() {
  return useContext(FilterContext);
}
