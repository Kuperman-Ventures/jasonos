"use client";

import { MAP_COLUMN_LABELS, grantTouchesNode, mapColumns, statusStroke } from "@/lib/connections/logic";
import type { ConnectionGrant, ConnectionNode } from "@/lib/connections/types";

const WIDTH = 1180;
const COL_X = [20, 440, 860] as const;
const NODE_W = 300;
const ROW_H = 40;
const TOP = 40;
const HEADS = ["Your accounts", "Tools holding access", "Apps they reach"] as const;

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function ConnectionsMap({
  grants,
  nodesByName,
  selected,
  onSelect,
}: {
  grants: ConnectionGrant[];
  nodesByName: Map<string, ConnectionNode>;
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  if (!grants.length) {
    return (
      <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-[var(--jos-muted)]">
        No grants to draw for the current filters.
      </div>
    );
  }

  const cols = mapColumns(grants);
  const longest = Math.max(...cols.map((c) => c.length));
  const height = TOP + longest * ROW_H + 10;
  const ypos = cols.map((col) => {
    const offset = ((longest - col.length) * ROW_H) / 2;
    return new Map(col.map((name, i) => [name, TOP + offset + i * ROW_H + 15]));
  });

  const seen = new Set<string>();
  const edges: { key: string; d: string; color: string; touched: boolean }[] = [];
  for (const g of grants) {
    const pairs: [number, string, number, string][] = [
      [0, g.identity, 1, g.hub],
      [1, g.hub, 2, g.target],
    ];
    for (const [a, an, b, bn] of pairs) {
      const key = `${a}|${an}|${bn}|${g.status}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const x1 = COL_X[a] + NODE_W;
      const y1 = ypos[a].get(an) ?? 0;
      const x2 = COL_X[b];
      const y2 = ypos[b].get(bn) ?? 0;
      const mx = (x1 + x2) / 2;
      edges.push({
        key,
        d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
        color: statusStroke(g.status),
        touched: selected ? grantTouchesNode(g, selected) : false,
      });
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width={WIDTH}
        height={height}
        role="group"
        aria-label="Map of accounts, tools and apps. Select a box to see its details."
      >
        {edges.map((e) => (
          <path
            key={e.key}
            d={e.d}
            fill="none"
            stroke={e.color}
            strokeWidth={e.touched ? 2.6 : 1.6}
            strokeOpacity={!selected ? 0.75 : e.touched ? 1 : 0.15}
          />
        ))}
        {HEADS.map((h, i) => (
          <text
            key={h}
            x={COL_X[i]}
            y={20}
            fill="var(--jos-muted)"
            fontSize={11}
            fontWeight={600}
            letterSpacing={1.2}
          >
            {h.toUpperCase()}
          </text>
        ))}
        {cols.map((col, i) =>
          col.map((name) => {
            const y = ypos[i].get(name) ?? 0;
            const count = nodesByName.get(name)?.items?.length ?? 0;
            const isSelected = selected === name;
            return (
              <g
                key={`${i}-${name}`}
                role="button"
                tabIndex={0}
                aria-label={`${name}. ${MAP_COLUMN_LABELS[i]}. Show details.`}
                aria-pressed={isSelected}
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-[var(--jos-focus)] [&:focus-visible>rect]:[stroke-width:2.5]"
                onClick={() => onSelect(name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(name);
                  }
                }}
              >
                <title>{name}</title>
                <rect
                  x={COL_X[i]}
                  y={y - 14}
                  width={NODE_W}
                  height={28}
                  rx={6}
                  fill="var(--jos-bg)"
                  stroke={isSelected ? "var(--jos-focus)" : i === 1 ? "var(--jos-action)" : "var(--jos-line)"}
                  strokeWidth={isSelected ? 2.5 : 1}
                />
                <text x={COL_X[i] + 10} y={y + 4} fill="var(--jos-ink)" fontSize={13}>
                  {truncate(name, count ? 34 : 40)}
                </text>
                {count ? (
                  <text
                    x={COL_X[i] + NODE_W - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill="var(--jos-action)"
                    fontSize={12}
                    fontWeight={700}
                  >
                    {count} ›
                  </text>
                ) : null}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}
