"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "className"
> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Classes on the wrapping relative container. */
  className?: string;
  /** Classes on the input element. */
  inputClassName?: string;
};

/**
 * Search field with magnifying-glass icon and a clear (X) when there is text.
 * Matches the clear affordance from native type=search (as on Scoreboard),
 * with an explicit button so every browser gets the same control.
 */
function SearchInput({
  value,
  onValueChange,
  className,
  inputClassName,
  placeholder = "Search…",
  disabled,
  ...props
}: SearchInputProps) {
  const showClear = value.length > 0 && !disabled;

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          "h-9 pl-8 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
          showClear ? "pr-8" : "pr-2.5",
          inputClassName
        )}
        {...props}
      />
      {showClear ? (
        <button
          type="button"
          onClick={() => onValueChange("")}
          className="absolute top-1/2 right-1.5 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Clear search"
          title="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export { SearchInput };
