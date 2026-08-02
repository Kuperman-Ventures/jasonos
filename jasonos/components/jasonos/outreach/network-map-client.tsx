"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import type {
  NetworkMapData,
  NetworkMapEdge,
  NetworkMapNode,
} from "@/lib/server-actions/network-map";
import { NETWORK_ROLE_SHORT } from "@/lib/outreach/types";
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
} from "lucide-react";

type SimNode = NetworkMapNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type ViewTransform = { x: number; y: number; k: number };

const DEGREE_COLOR: Record<string, string> = {
  you: "hsl(var(--foreground))",
  "1": "hsl(142 60% 42%)",
  "2": "hsl(210 80% 55%)",
  "3": "hsl(32 90% 50%)",
  "?": "hsl(var(--muted-foreground))",
};

function degreeKey(n: NetworkMapNode): string {
  if (n.isYou) return "you";
  if (n.degree === 1 || n.degree === 2 || n.degree === 3) return String(n.degree);
  return "?";
}

/** Prefer "First Last" when a longer name is present. */
function displayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ") || "Unknown";
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function nodeSize(n: NetworkMapNode): { w: number; h: number } {
  if (n.isYou) return { w: 72, h: 36 };
  const label = displayName(n.name);
  const firm = n.firm?.trim() ?? "";
  const textW = Math.max(label.length, firm.length) * 6.6;
  const w = Math.min(168, Math.max(88, textW + 20));
  const h = firm ? 40 : 30;
  return { w, h };
}

/** Edge endpoint padding so lines stop at the card border, not the center. */
function edgePad(
  n: NetworkMapNode,
  dx: number,
  dy: number
): { px: number; py: number } {
  const { w, h } = nodeSize(n);
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  // Intersect ray with axis-aligned rect half-extents
  const hx = w / 2 + 2;
  const hy = h / 2 + 2;
  const tx = Math.abs(ux) < 1e-6 ? Infinity : hx / Math.abs(ux);
  const ty = Math.abs(uy) < 1e-6 ? Infinity : hy / Math.abs(uy);
  const t = Math.min(tx, ty);
  return { px: ux * t, py: uy * t };
}

function chainFor(
  nodeId: string,
  edges: NetworkMapEdge[],
  nodesById: Map<string, NetworkMapNode>
): string[] {
  const parent = new Map<string, string>();
  for (const e of edges) {
    if (e.kind === "referral") parent.set(e.target, e.source);
  }
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur: string | null = nodeId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    chain.unshift(nodesById.get(cur)?.name ?? "Unknown");
    cur = parent.get(cur) ?? null;
  }
  return chain;
}

function runForce(
  nodes: SimNode[],
  edges: NetworkMapEdge[],
  width: number,
  height: number,
  ticks = 220
) {
  const cx = width / 2;
  const cy = height / 2;
  const you = nodes.find((n) => n.isYou);
  if (you) {
    you.x = cx;
    you.y = cy;
  }

  // Seed by degree rings so the layout starts readable.
  const byDeg = new Map<string, SimNode[]>();
  for (const n of nodes) {
    if (n.isYou) continue;
    const k = degreeKey(n);
    const arr = byDeg.get(k) ?? [];
    arr.push(n);
    byDeg.set(k, arr);
  }
  const ringRadius: Record<string, number> = {
    "1": Math.min(width, height) * 0.26,
    "?": Math.min(width, height) * 0.26,
    "2": Math.min(width, height) * 0.42,
    "3": Math.min(width, height) * 0.56,
  };
  for (const [k, arr] of byDeg) {
    const r = ringRadius[k] ?? 180;
    arr.forEach((n, i) => {
      const a = (i / Math.max(arr.length, 1)) * Math.PI * 2 - Math.PI / 2;
      n.x = cx + Math.cos(a) * r;
      n.y = cy + Math.sin(a) * r;
    });
  }

  const idx = new Map(nodes.map((n, i) => [n.id, i]));

  for (let t = 0; t < ticks; t++) {
    const alpha = 1 - t / ticks;

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist2 = dx * dx + dy * dy || 0.01;
        const dist = Math.sqrt(dist2);
        const force = (2200 * alpha) / dist2;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (!a.isYou) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (!b.isYou) {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    // Springs along edges
    for (const e of edges) {
      const si = idx.get(e.source);
      const ti = idx.get(e.target);
      if (si == null || ti == null) continue;
      const a = nodes[si];
      const b = nodes[ti];
      const ideal = e.kind === "knows" ? 190 : 150;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const diff = dist - ideal;
      const force = diff * 0.045 * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.isYou) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.isYou) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Pull toward degree rings
    for (const n of nodes) {
      if (n.isYou) continue;
      const r = ringRadius[degreeKey(n)] ?? 180;
      const dx = n.x - cx;
      const dy = n.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const pull = (dist - r) * 0.02 * alpha;
      n.vx -= (dx / dist) * pull;
      n.vy -= (dy / dist) * pull;
    }

    // Integrate
    for (const n of nodes) {
      if (n.isYou) {
        n.x = cx;
        n.y = cy;
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(60, Math.min(width - 60, n.x));
      n.y = Math.max(40, Math.min(height - 40, n.y));
    }
  }
}

export function NetworkMapClient({ data }: { data: NetworkMapData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 960, h: 640 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [degreeFilter, setDegreeFilter] = useState<"all" | "1" | "2" | "3">("all");
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{
    mode: "pan" | "node";
    id?: string;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);

  const nodesById = useMemo(
    () => new Map(data.nodes.map((n) => [n.id, n])),
    [data.nodes]
  );

  const matchQuery = useCallback(
    (n: NetworkMapNode) => {
      if (n.isYou) return true;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        n.name.toLowerCase().includes(q) ||
        (n.firm ?? "").toLowerCase().includes(q) ||
        (n.title ?? "").toLowerCase().includes(q)
      );
    },
    [query]
  );

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of data.nodes) {
      if (n.isYou) {
        ids.add(n.id);
        continue;
      }
      const degOk =
        degreeFilter === "all" || String(n.degree) === degreeFilter;
      if (degOk && matchQuery(n)) ids.add(n.id);
    }
    // Keep endpoints of edges that touch a visible non-you node so chains stay intact
    for (const e of data.edges) {
      if (e.kind !== "referral") continue;
      if (ids.has(e.source) || ids.has(e.target)) {
        ids.add(e.source);
        ids.add(e.target);
      }
    }
    ids.add("__you__");
    return ids;
  }, [data, degreeFilter, matchQuery]);

  const visibleEdges = useMemo(
    () =>
      data.edges.filter(
        (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
      ),
    [data.edges, visibleIds]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({
        w: Math.max(640, Math.floor(cr.width)),
        h: Math.max(480, Math.floor(cr.height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const nodes: SimNode[] = data.nodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => ({
        ...n,
        x: size.w / 2,
        y: size.h / 2,
        vx: 0,
        vy: 0,
      }));
    runForce(nodes, visibleEdges, size.w, size.h);
    setSimNodes(nodes);
  }, [data.nodes, visibleEdges, visibleIds, size.w, size.h]);

  const selected = selectedId ? nodesById.get(selectedId) ?? null : null;
  const selectedChain = selected
    ? chainFor(selected.id, data.edges, nodesById)
    : [];

  const highlight = useMemo(() => {
    const set = new Set<string>();
    const focus = selectedId || hoverId;
    if (!focus) return set;
    set.add(focus);
    for (const e of data.edges) {
      if (e.source === focus || e.target === focus) {
        set.add(e.source);
        set.add(e.target);
      }
    }
    // Full referral ancestry + descendants
    const parent = new Map<string, string>();
    const children = new Map<string, string[]>();
    for (const e of data.edges) {
      if (e.kind !== "referral") continue;
      parent.set(e.target, e.source);
      const arr = children.get(e.source) ?? [];
      arr.push(e.target);
      children.set(e.source, arr);
    }
    let cur: string | undefined = focus;
    while (cur) {
      set.add(cur);
      cur = parent.get(cur);
    }
    const stack = [focus];
    while (stack.length) {
      const id = stack.pop()!;
      for (const c of children.get(id) ?? []) {
        if (!set.has(c)) {
          set.add(c);
          stack.push(c);
        }
      }
    }
    return set;
  }, [selectedId, hoverId, data.edges]);

  const dimmed = Boolean(selectedId || hoverId);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform((t) => ({
      ...t,
      k: Math.min(2.5, Math.max(0.4, t.k * factor)),
    }));
  }

  function onPointerDown(e: React.PointerEvent) {
    const target = e.target as Element;
    const nodeId = target.closest("[data-node-id]")?.getAttribute("data-node-id");
    if (nodeId && nodeId !== "__you__") {
      dragRef.current = {
        mode: "node",
        id: nodeId,
        sx: e.clientX,
        sy: e.clientY,
        ox: 0,
        oy: 0,
      };
      setSelectedId(nodeId);
    } else {
      dragRef.current = {
        mode: "pan",
        sx: e.clientX,
        sy: e.clientY,
        ox: transform.x,
        oy: transform.y,
      };
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "pan") {
      setTransform((t) => ({
        ...t,
        x: d.ox + (e.clientX - d.sx),
        y: d.oy + (e.clientY - d.sy),
      }));
    } else if (d.id) {
      const dx = (e.clientX - d.sx) / transform.k;
      const dy = (e.clientY - d.sy) / transform.k;
      d.sx = e.clientX;
      d.sy = e.clientY;
      setSimNodes((prev) =>
        prev.map((n) =>
          n.id === d.id ? { ...n, x: n.x + dx, y: n.y + dy, vx: 0, vy: 0 } : n
        )
      );
    }
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  const pos = useMemo(() => {
    const m = new Map<string, SimNode>();
    for (const n of simNodes) m.set(n.id, n);
    return m;
  }, [simNodes]);

  if (!data.nodes.length || data.stats.referrals === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="text-base font-semibold tracking-tight">
            No referral links yet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            When you log who introduced whom on a contact, those 1→2→3 chains
            show up here as a network web.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6.5rem)] min-h-[520px] flex-col md:flex-row">
      {/* Canvas */}
      <div className="relative min-h-0 min-w-0 flex-1">
        <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/85 px-3 py-2 backdrop-blur">
          <div className="relative min-w-[180px] flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people or firms…"
              className="h-8 w-full rounded-md border bg-background pl-7 pr-2 text-sm outline-none focus:border-foreground/40"
            />
          </div>
          <div className="flex items-center gap-1">
            {(["all", "1", "2", "3"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDegreeFilter(d)}
                className={cn(
                  "h-7 rounded-md px-2 text-xs transition-colors",
                  degreeFilter === d
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {d === "all" ? "All" : `Deg ${d}`}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-muted"
              aria-label="Zoom out"
              onClick={() =>
                setTransform((t) => ({ ...t, k: Math.max(0.4, t.k * 0.9) }))
              }
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-muted"
              aria-label="Zoom in"
              onClick={() =>
                setTransform((t) => ({ ...t, k: Math.min(2.5, t.k * 1.1) }))
              }
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background hover:bg-muted"
              aria-label="Reset view"
              onClick={() => setTransform({ x: 0, y: 0, k: 1 })}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-xs hover:bg-muted"
              onClick={() => {
                setSelectedId(null);
                setTransform({ x: 0, y: 0, k: 1 });
              }}
            >
              <Crosshair className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing pt-12"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${size.w} ${size.h}`}
            className="h-full w-full touch-none select-none"
            role="img"
            aria-label="Referral network map"
          >
            <defs>
              <marker
                id="arrow-referral"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(210 80% 55% / 0.85)" />
              </marker>
              <radialGradient id="youGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--foreground) / 0.25)" />
                <stop offset="100%" stopColor="hsl(var(--foreground) / 0)" />
              </radialGradient>
            </defs>

            <g
              transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}
            >
              {/* soft ring guides */}
              {[0.26, 0.42, 0.56].map((f, i) => (
                <circle
                  key={f}
                  cx={size.w / 2}
                  cy={size.h / 2}
                  r={Math.min(size.w, size.h) * f}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 6"
                  opacity={0.45}
                >
                  <title>{`Degree ${i + 1} ring`}</title>
                </circle>
              ))}

              {visibleEdges.map((e) => {
                const a = pos.get(e.source);
                const b = pos.get(e.target);
                if (!a || !b) return null;
                const active =
                  !dimmed || (highlight.has(e.source) && highlight.has(e.target));
                const isReferral = e.kind === "referral";
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const from = edgePad(a, dx, dy);
                const to = edgePad(b, -dx, -dy);
                const x1 = a.x + from.px;
                const y1 = a.y + from.py;
                const x2 = b.x + to.px;
                const y2 = b.y + to.py;
                return (
                  <line
                    key={e.id}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={
                      isReferral
                        ? "hsl(210 80% 55%)"
                        : "hsl(var(--muted-foreground))"
                    }
                    strokeWidth={isReferral ? 1.6 : 1}
                    strokeDasharray={isReferral ? undefined : "4 4"}
                    strokeOpacity={active ? (isReferral ? 0.85 : 0.35) : 0.08}
                    markerEnd={isReferral && active ? "url(#arrow-referral)" : undefined}
                  />
                );
              })}

              {simNodes.map((n) => {
                const key = degreeKey(n);
                const color = DEGREE_COLOR[key] ?? DEGREE_COLOR["?"];
                const active = !dimmed || highlight.has(n.id);
                const { w, h } = nodeSize(n);
                const label = n.isYou ? "You" : displayName(n.name);
                const firm = n.firm?.trim() ?? "";
                const selected = selectedId === n.id;
                return (
                  <g
                    key={n.id}
                    data-node-id={n.id}
                    transform={`translate(${n.x} ${n.y})`}
                    className="cursor-pointer"
                    opacity={active ? 1 : 0.18}
                    onMouseEnter={() => setHoverId(n.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedId(n.id);
                    }}
                  >
                    {n.isYou ? (
                      <ellipse
                        rx={w * 0.9}
                        ry={h * 1.15}
                        fill="url(#youGlow)"
                      />
                    ) : null}
                    <rect
                      x={-w / 2}
                      y={-h / 2}
                      width={w}
                      height={h}
                      rx={8}
                      ry={8}
                      fill={
                        n.isYou
                          ? "hsl(var(--background))"
                          : "hsl(var(--card))"
                      }
                      stroke={
                        selected
                          ? "hsl(var(--foreground))"
                          : n.isYou
                            ? "hsl(var(--foreground))"
                            : color
                      }
                      strokeWidth={selected || n.isYou ? 2 : 1.5}
                    />
                    {/* degree accent bar */}
                    {!n.isYou ? (
                      <rect
                        x={-w / 2}
                        y={-h / 2}
                        width={4}
                        height={h}
                        rx={2}
                        fill={color}
                        className="pointer-events-none"
                      />
                    ) : null}
                    <text
                      textAnchor="middle"
                      y={firm && !n.isYou ? -4 : 1}
                      dominantBaseline="middle"
                      fill="hsl(var(--foreground))"
                      fontSize={n.isYou ? 12 : 11}
                      fontWeight={650}
                      className="pointer-events-none"
                    >
                      {label}
                    </text>
                    {firm && !n.isYou ? (
                      <text
                        textAnchor="middle"
                        y={10}
                        dominantBaseline="middle"
                        fill="hsl(var(--muted-foreground))"
                        fontSize={9}
                        className="pointer-events-none"
                      >
                        {firm.length > 22 ? `${firm.slice(0, 20)}…` : firm}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 text-[11px]">
          <LegendDot color={DEGREE_COLOR.you} label="You" />
          <LegendDot color={DEGREE_COLOR["1"]} label="1 — know well" />
          <LegendDot color={DEGREE_COLOR["2"]} label="2 — intro’d by a 1" />
          <LegendDot color={DEGREE_COLOR["3"]} label="3 — intro’d by a 2" />
          <span className="rounded-md border bg-background/90 px-2 py-1 text-muted-foreground">
            Solid arrow = referred · Dashed = you know
          </span>
        </div>
      </div>

      {/* Side panel */}
      <aside className="w-full shrink-0 border-t md:w-[300px] md:border-l md:border-t-0">
        <div className="border-b px-4 py-3">
          <h1 className="text-sm font-semibold tracking-tight">Network Map</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Who introduced whom — your 1→2→3 referral web.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b px-4 py-3 text-center">
          <Stat label="People" value={data.stats.people} />
          <Stat label="Referrals" value={data.stats.referrals} />
          <Stat label="Deg 3" value={data.stats.degree3} />
        </div>
        <div className="grid grid-cols-3 gap-2 border-b px-4 py-2 text-center text-[11px] text-muted-foreground">
          <div>1s · {data.stats.degree1}</div>
          <div>2s · {data.stats.degree2}</div>
          <div>3s · {data.stats.degree3}</div>
        </div>

        <div className="space-y-3 p-4">
          {selected && !selected.isYou ? (
            <>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Selected
                </div>
                <div className="mt-1 text-sm font-semibold">{selected.name}</div>
                {selected.firm ? (
                  <div className="text-xs text-muted-foreground">{selected.firm}</div>
                ) : null}
                {selected.title ? (
                  <div className="text-xs text-muted-foreground">{selected.title}</div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selected.degree ? (
                  <Pill>Degree {selected.degree}</Pill>
                ) : (
                  <Pill>Source / channel</Pill>
                )}
                {selected.tier ? <Pill>Tier {selected.tier}</Pill> : null}
                {selected.role ? (
                  <Pill>{NETWORK_ROLE_SHORT[selected.role] ?? selected.role}</Pill>
                ) : null}
                {selected.referralCount > 0 ? (
                  <Pill>{selected.referralCount} referred out</Pill>
                ) : null}
              </div>
              {selectedChain.length > 1 ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Introduction path
                  </div>
                  <ol className="mt-2 space-y-1.5">
                    {selectedChain.map((name, i) => (
                      <li key={`${name}-${i}`} className="flex items-center gap-2 text-xs">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-medium">
                          {i + 1}
                        </span>
                        <span>{name}</span>
                        {i < selectedChain.length - 1 ? (
                          <span className="text-muted-foreground">→</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No upstream referral recorded for this person.
                </p>
              )}
              <a
                href="/outreach/people"
                className="inline-flex text-xs text-foreground underline-offset-2 hover:underline"
              >
                Open People
              </a>
            </>
          ) : (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                Click a person to see their introduction path. Drag the canvas to
                pan, scroll to zoom, drag a node to reposition.
              </p>
              <p>
                Rings are approximate degree bands: inner = people you know well,
                middle = their intros, outer = second-hop intros.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="num-mono text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 text-[11px]">
      {children}
    </span>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-background/90 px-2 py-1">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}
