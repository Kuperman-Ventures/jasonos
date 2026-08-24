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
import {
  NETWORK_ROLE_SHORT,
  RELEVANCE_TIERS,
  RELEVANCE_TIER_LABELS,
  type RelevanceTier,
} from "@/lib/outreach/types";
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  RotateCcw,
} from "lucide-react";
import { OutreachModal } from "@/components/jasonos/outreach/outreach-modal";

type SimNode = NetworkMapNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type ViewTransform = { x: number; y: number; k: number };

/** Normalized canvas coords (0–1) so positions survive resize + reloads. */
type PinnedPos = { nx: number; ny: number };
type PinnedMap = Record<string, PinnedPos>;

const POSITIONS_KEY = "jasonos.network-map.positions.v1";

function loadPinnedPositions(): PinnedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(POSITIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PinnedMap;
    if (!parsed || typeof parsed !== "object") return {};
    const out: PinnedMap = {};
    for (const [id, pos] of Object.entries(parsed)) {
      if (
        pos &&
        typeof pos.nx === "number" &&
        typeof pos.ny === "number" &&
        Number.isFinite(pos.nx) &&
        Number.isFinite(pos.ny)
      ) {
        // Allow positions outside 0–1 so users can park boxes past the
        // initial canvas edges (pan/zoom to find them later).
        out[id] = { nx: pos.nx, ny: pos.ny };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function savePinnedPositions(map: PinnedMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POSITIONS_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private-mode failures
  }
}

// Theme tokens are oklch() values — use var(...) directly, never hsl(var(...)).
const DEGREE_COLOR: Record<string, string> = {
  you: "var(--foreground)",
  "1": "#2f9d5d",
  "2": "#3b82f6",
  "3": "#e09b24",
  channel: "#8b6bb5",
  "?": "var(--muted-foreground)",
};

const NODE_W = 132;
const NODE_H = 44;
const YOU_W = 72;
const YOU_H = 36;

function degreeKey(n: NetworkMapNode): string {
  if (n.isYou) return "you";
  if (n.isChannel) return "channel";
  if (n.degree === 1 || n.degree === 2 || n.degree === 3) return String(n.degree);
  return "?";
}

/** Prefer "First Last" when a longer name is present. Keep channel names intact. */
function displayName(n: NetworkMapNode | string): string {
  if (typeof n !== "string") {
    if (n.isChannel || n.isYou) return n.name;
    return displayName(n.name);
  }
  const parts = n.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ") || "Unknown";
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function fitLabel(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(1, maxChars - 1))}…`;
}

function nodeSize(n: NetworkMapNode): { w: number; h: number } {
  if (n.isYou) return { w: YOU_W, h: YOU_H };
  return { w: NODE_W, h: NODE_H };
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

type ChainHop = { id: string; name: string; isYou: boolean };

function chainFor(
  nodeId: string,
  edges: NetworkMapEdge[],
  nodesById: Map<string, NetworkMapNode>
): ChainHop[] {
  const parent = new Map<string, string>();
  for (const e of edges) {
    if (e.kind === "referral") parent.set(e.target, e.source);
  }
  const chain: ChainHop[] = [];
  const seen = new Set<string>();
  let cur: string | null = nodeId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const node = nodesById.get(cur);
    chain.unshift({
      id: cur,
      name: node?.name ?? "Unknown",
      isYou: Boolean(node?.isYou),
    });
    cur = parent.get(cur) ?? null;
  }
  return chain;
}

/**
 * Strict concentric layout:
 *   Ring 1 — people you know well + referral channels
 *   Ring 2 — their referrals, clustered under each parent
 *   Ring 3 — second-hop referrals, clustered under their parent
 */
function layoutConcentric(
  nodes: SimNode[],
  edges: NetworkMapEdge[],
  width: number,
  height: number
) {
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const R1 = minDim * 0.28;
  const R2 = minDim * 0.5;
  const R3 = minDim * 0.72;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  for (const e of edges) {
    if (e.kind !== "referral") continue;
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    parentOf.set(e.target, e.source);
    const arr = childrenOf.get(e.source) ?? [];
    arr.push(e.target);
    childrenOf.set(e.source, arr);
  }

  const place = (n: SimNode, angle: number, radius: number) => {
    n.x = cx + Math.cos(angle) * radius;
    n.y = cy + Math.sin(angle) * radius;
    n.vx = 0;
    n.vy = 0;
  };

  const you = nodes.find((n) => n.isYou);
  if (you) place(you, 0, 0);

  const others = nodes.filter((n) => !n.isYou);
  const byName = (a: SimNode, b: SimNode) => a.name.localeCompare(b.name);

  // Ring 1 roots: channels and people not introduced via someone on this map.
  const ring1 = others
    .filter((n) => n.isChannel || !parentOf.has(n.id))
    .sort(byName);
  const ring1Ids = new Set(ring1.map((n) => n.id));
  const angles = new Map<string, number>();

  ring1.forEach((n, i) => {
    const angle =
      (i / Math.max(ring1.length, 1)) * Math.PI * 2 - Math.PI / 2;
    angles.set(n.id, angle);
    place(n, angle, R1);
  });

  const placeChildrenOnRing = (
    parents: SimNode[],
    radius: number,
    exclude: Set<string>
  ): SimNode[] => {
    const placed: SimNode[] = [];
    const parentSlot = (2 * Math.PI) / Math.max(parents.length, 1);

    for (const p of parents) {
      const kids = (childrenOf.get(p.id) ?? [])
        .map((id) => byId.get(id))
        .filter((n): n is SimNode => n != null && !exclude.has(n.id))
        .sort(byName);
      if (!kids.length) continue;

      const parentAngle = angles.get(p.id) ?? 0;
      const spread = Math.min(
        parentSlot * 0.9,
        Math.max(0.22, kids.length * 0.16)
      );

      kids.forEach((n, i) => {
        const t = kids.length === 1 ? 0.5 : i / (kids.length - 1);
        const angle = parentAngle - spread / 2 + t * spread;
        angles.set(n.id, angle);
        place(n, angle, radius);
        placed.push(n);
        exclude.add(n.id);
      });
    }
    return placed;
  };

  const claimed = new Set(ring1Ids);
  const ring2 = placeChildrenOnRing(ring1, R2, claimed);

  // Any remaining degree-2 (or unplaced with a missing parent) → even on ring 2.
  const leftovers2 = others
    .filter((n) => !claimed.has(n.id) && n.degree !== 3)
    .sort(byName);
  if (leftovers2.length) {
    const start = ring2.length;
    leftovers2.forEach((n, i) => {
      const angle =
        ((start + i) / Math.max(start + leftovers2.length, 1)) *
          Math.PI *
          2 -
        Math.PI / 2;
      angles.set(n.id, angle);
      place(n, angle, R2);
      claimed.add(n.id);
      ring2.push(n);
    });
  }

  const ring2Parents = ring2.length ? ring2 : ring1;
  placeChildrenOnRing(ring2Parents, R3, claimed);

  // Final leftovers (true degree-3 orphans) → even on ring 3.
  const leftovers3 = others.filter((n) => !claimed.has(n.id)).sort(byName);
  leftovers3.forEach((n, i) => {
    const angle =
      (i / Math.max(leftovers3.length, 1)) * Math.PI * 2 - Math.PI / 2;
    place(n, angle, R3);
    claimed.add(n.id);
  });
}

/** Map screen pointer → world coords inside the pan/zoom group. */
function clientToWorld(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  transform: ViewTransform
): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const svgPt = pt.matrixTransform(ctm.inverse());
  return {
    x: (svgPt.x - transform.x) / transform.k,
    y: (svgPt.y - transform.y) / transform.k,
  };
}

export function NetworkMapClient({ data }: { data: NetworkMapData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 960, h: 640 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalTarget, setModalTarget] = useState<{
    id: string;
    name: string;
    title: string | null;
    firm: string | null;
  } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [degreeFilter, setDegreeFilter] = useState<"all" | "1" | "2" | "3">("all");
  const [tierFilter, setTierFilter] = useState<"all" | RelevanceTier>("all");
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const [pinned, setPinned] = useState<PinnedMap>({});
  const [pinnedReady, setPinnedReady] = useState(false);
  /** Bump to force a fresh concentric layout (e.g. Reset layout). */
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const dragRef = useRef<{
    mode: "pan" | "node";
    id?: string;
    sx: number;
    sy: number;
    /** Pointer offset from node center (world space), or pan origin. */
    ox: number;
    oy: number;
    startX?: number;
    startY?: number;
    moved?: boolean;
  } | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const pinnedRef = useRef<PinnedMap>({});
  const sizeRef = useRef(size);
  /** Suppress the click that follows a completed node drag. */
  const suppressClickRef = useRef(false);
  simNodesRef.current = simNodes;
  pinnedRef.current = pinned;
  sizeRef.current = size;

  // Load saved drop positions after mount (client-only).
  useEffect(() => {
    const loaded = loadPinnedPositions();
    setPinned(loaded);
    pinnedRef.current = loaded;
    setPinnedReady(true);
  }, []);

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
      // Channels have no A/B/C tier — hide them while a tier filter is on.
      if (tierFilter !== "all" && n.isChannel) continue;
      const degOk =
        degreeFilter === "all" || String(n.degree) === degreeFilter;
      // Tier filter is strict: only contacts with that relevance tier.
      const tierOk = tierFilter === "all" || n.tier === tierFilter;
      if (degOk && tierOk && matchQuery(n)) ids.add(n.id);
    }
    // When NOT filtering by tier, keep referral-chain neighbors so intro
    // paths stay readable. Tier A/B/C must show only that tier.
    if (tierFilter === "all") {
      for (const e of data.edges) {
        if (e.kind !== "referral") continue;
        if (ids.has(e.source) || ids.has(e.target)) {
          ids.add(e.source);
          ids.add(e.target);
        }
      }
    }
    ids.add("__you__");
    return ids;
  }, [data, degreeFilter, tierFilter, matchQuery]);

  // Drop selection if the selected person is hidden by the current filters.
  useEffect(() => {
    if (selectedId && selectedId !== "__you__" && !visibleIds.has(selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, visibleIds]);

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
      // Use the real container size so viewBox units match screen pixels
      // (fake mins made drag lag/fight the cursor).
      setSize({
        w: Math.max(1, Math.floor(cr.width)),
        h: Math.max(1, Math.floor(cr.height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!pinnedReady) return;
    const nodes: SimNode[] = data.nodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => ({
        ...n,
        x: size.w / 2,
        y: size.h / 2,
        vx: 0,
        vy: 0,
      }));
    layoutConcentric(nodes, visibleEdges, size.w, size.h);

    // Re-apply any manually dropped positions (survives reload + resize).
    // Read from ref so saving one drag doesn't reshuffle unpinned nodes.
    // No edge clamp — users can place boxes anywhere, including past edges.
    const savedMap = pinnedRef.current;
    for (const n of nodes) {
      if (n.isYou) continue;
      const saved = savedMap[n.id];
      if (!saved) continue;
      n.x = saved.nx * size.w;
      n.y = saved.ny * size.h;
      n.vx = 0;
      n.vy = 0;
    }
    setSimNodes(nodes);
  }, [
    data.nodes,
    visibleEdges,
    visibleIds,
    size.w,
    size.h,
    pinnedReady,
    layoutEpoch,
  ]);

  const selected = selectedId ? nodesById.get(selectedId) ?? null : null;
  const selectedChain = selected
    ? chainFor(selected.id, data.edges, nodesById)
    : [];

  const openContactModal = useCallback(
    (node: Pick<NetworkMapNode, "id" | "name" | "title" | "firm" | "isYou">) => {
      if (node.isYou) return;
      setModalTarget({
        id: node.id,
        name: node.name,
        title: node.title,
        firm: node.firm,
      });
    },
    []
  );

  /** Focused node + full referral subtree (2nds and 3rds) + ancestry. */
  const highlight = useMemo(() => {
    const set = new Set<string>();
    const focus = selectedId || hoverId;
    if (!focus) return set;

    const parent = new Map<string, string>();
    const children = new Map<string, string[]>();
    for (const e of data.edges) {
      if (e.kind !== "referral") continue;
      parent.set(e.target, e.source);
      const arr = children.get(e.source) ?? [];
      arr.push(e.target);
      children.set(e.source, arr);
    }

    set.add(focus);

    // Walk up to the root introducer / channel.
    let cur: string | undefined = focus;
    while (cur) {
      set.add(cur);
      cur = parent.get(cur);
    }

    // Walk down through every referral hop (1 → 2 → 3 …).
    const stack = [focus];
    while (stack.length) {
      const id = stack.pop()!;
      for (const childId of children.get(id) ?? []) {
        if (set.has(childId)) continue;
        set.add(childId);
        stack.push(childId);
      }
    }

    // Keep the You hub lit so the dashed "knows / via channel" edge stays visible.
    if (set.size > 0) set.add("__you__");

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
    const svg = svgRef.current;
    if (nodeId && nodeId !== "__you__" && svg) {
      const node = simNodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;
      const world = clientToWorld(
        svg,
        e.clientX,
        e.clientY,
        transformRef.current
      );
      dragRef.current = {
        mode: "node",
        id: nodeId,
        sx: e.clientX,
        sy: e.clientY,
        ox: world.x - node.x,
        oy: world.y - node.y,
        startX: node.x,
        startY: node.y,
        moved: false,
      };
      setSelectedId(nodeId);
      e.preventDefault();
    } else {
      dragRef.current = {
        mode: "pan",
        sx: e.clientX,
        sy: e.clientY,
        ox: transformRef.current.x,
        oy: transformRef.current.y,
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
      const svg = svgRef.current;
      if (!svg) return;
      const world = clientToWorld(
        svg,
        e.clientX,
        e.clientY,
        transformRef.current
      );
      const x = world.x - d.ox;
      const y = world.y - d.oy;
      if (
        d.startX != null &&
        d.startY != null &&
        Math.hypot(x - d.startX, y - d.startY) > 2
      ) {
        d.moved = true;
      }
      setSimNodes((prev) =>
        prev.map((n) => {
          if (n.id !== d.id) return n;
          return { ...n, x, y, vx: 0, vy: 0 };
        })
      );
    }
  }

  function endPointerDrag() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.mode !== "node" || !d.id || !d.moved) return;
    suppressClickRef.current = true;
    const node = simNodesRef.current.find((n) => n.id === d.id);
    if (!node || node.isYou) return;
    const { w, h } = sizeRef.current;
    if (w < 1 || h < 1) return;
    const next: PinnedMap = {
      ...pinnedRef.current,
      [node.id]: {
        nx: node.x / w,
        ny: node.y / h,
      },
    };
    pinnedRef.current = next;
    setPinned(next);
    savePinnedPositions(next);
  }

  function resetPinnedLayout() {
    pinnedRef.current = {};
    setPinned({});
    savePinnedPositions({});
    setSelectedId(null);
    setTransform({ x: 0, y: 0, k: 1 });
    setLayoutEpoch((n) => n + 1);
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
          <div className="flex flex-wrap items-center gap-1">
            <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Deg
            </span>
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
                aria-pressed={degreeFilter === d}
              >
                {d === "all" ? "All" : d}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tier
            </span>
            {(["all", ...RELEVANCE_TIERS] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                title={t === "all" ? "All relevance tiers" : RELEVANCE_TIER_LABELS[t]}
                className={cn(
                  "h-7 rounded-md px-2 text-xs transition-colors",
                  tierFilter === t
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={tierFilter === t}
              >
                {t === "all" ? "All" : t}
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
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-xs hover:bg-muted"
              onClick={resetPinnedLayout}
              title="Clear saved positions and restore ring layout"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset layout
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing pt-12"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
        >
          <svg
            ref={svgRef}
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
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" fillOpacity="0.85" />
              </marker>
              <radialGradient id="youGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
              </radialGradient>
            </defs>

            <g
              transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}
            >
              {/* Concentric degree rings */}
              {[
                { f: 0.28, label: "1 — know well / channels" },
                { f: 0.5, label: "2 — intro’d by a 1" },
                { f: 0.72, label: "3 — intro’d by a 2" },
              ].map((ring) => (
                <circle
                  key={ring.f}
                  cx={size.w / 2}
                  cy={size.h / 2}
                  r={Math.min(size.w, size.h) * ring.f}
                  fill="none"
                  stroke="var(--border)"
                  strokeDasharray="3 6"
                  opacity={0.55}
                >
                  <title>{ring.label}</title>
                </circle>
              ))}

              {visibleEdges.map((e) => {
                const a = pos.get(e.source);
                const b = pos.get(e.target);
                if (!a || !b) return null;
                const inSubtree =
                  highlight.has(e.source) && highlight.has(e.target);
                // When focused, only light referral edges inside the subtree
                // (plus the You→focus knows edge). Dim everything else hard.
                const active = !dimmed
                  ? true
                  : e.kind === "referral"
                    ? inSubtree
                    : inSubtree &&
                      (e.source === selectedId ||
                        e.target === selectedId ||
                        e.source === hoverId ||
                        e.target === hoverId ||
                        e.source === "__you__" ||
                        e.target === "__you__");
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
                      isReferral ? "#3b82f6" : "var(--muted-foreground)"
                    }
                    strokeWidth={
                      active && dimmed && isReferral ? 2.2 : isReferral ? 1.6 : 1
                    }
                    strokeDasharray={isReferral ? undefined : "4 4"}
                    strokeOpacity={
                      active
                        ? isReferral
                          ? dimmed
                            ? 1
                            : 0.85
                          : 0.4
                        : 0.06
                    }
                    markerEnd={
                      isReferral && active ? "url(#arrow-referral)" : undefined
                    }
                  />
                );
              })}

              {simNodes.map((n) => {
                const key = degreeKey(n);
                const color = DEGREE_COLOR[key] ?? DEGREE_COLOR["?"];
                const active = !dimmed || highlight.has(n.id);
                const { w, h } = nodeSize(n);
                const label = fitLabel(
                  n.isYou ? "You" : displayName(n),
                  n.isYou ? 8 : 18
                );
                const sub = n.isYou
                  ? ""
                  : fitLabel(
                      n.isChannel ? "Channel" : n.firm?.trim() || "—",
                      20
                    );
                const selected = selectedId === n.id;
                return (
                  <g
                    key={n.id}
                    data-node-id={n.id}
                    transform={`translate(${n.x} ${n.y})`}
                    className={
                      n.isYou ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                    }
                    opacity={active ? 1 : 0.18}
                    onMouseEnter={() => setHoverId(n.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }
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
                          ? "var(--background)"
                          : n.isChannel
                            ? "color-mix(in oklch, #8b6bb5 16%, var(--card))"
                            : "var(--card)"
                      }
                      stroke={
                        selected || n.isYou ? "var(--foreground)" : color
                      }
                      strokeWidth={selected || n.isYou || n.isChannel ? 2 : 1.5}
                      strokeDasharray={n.isChannel ? "4 2" : undefined}
                    />
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
                      x={0}
                      y={n.isYou ? 1 : -5}
                      dominantBaseline="middle"
                      fill="var(--foreground)"
                      fontSize={n.isYou ? 12 : 11}
                      fontWeight={650}
                      style={{ pointerEvents: "none" }}
                    >
                      {label}
                    </text>
                    {!n.isYou ? (
                      <text
                        textAnchor="middle"
                        x={0}
                        y={11}
                        dominantBaseline="middle"
                        fill={
                          n.isChannel
                            ? DEGREE_COLOR.channel
                            : "var(--muted-foreground)"
                        }
                        fontSize={9}
                        fontWeight={n.isChannel ? 600 : 400}
                        style={{ pointerEvents: "none" }}
                      >
                        {sub}
                      </text>
                    ) : null}
                    <title>
                      {n.isYou
                        ? "You"
                        : `${displayName(n)}${n.firm ? ` · ${n.firm}` : ""}${
                            n.isChannel ? " · Referral channel" : ""
                          }`}
                    </title>
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
          <LegendDot
            color={DEGREE_COLOR.channel}
            label="Channel (Boardy, Connective, …)"
          />
          <span className="rounded-md border bg-background/90 px-2 py-1 text-muted-foreground">
            Solid arrow = referred · Dashed = you know / via channel
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
        {tierFilter !== "all" || degreeFilter !== "all" ? (
          <div className="border-b px-4 py-2 text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {[...visibleIds].filter((id) => id !== "__you__").length}
            </span>
            {" · "}
            {tierFilter !== "all" ? `Tier ${tierFilter}` : "All tiers"}
            {degreeFilter !== "all" ? ` · Deg ${degreeFilter}` : ""}
            {tierFilter !== "all" ? " only" : ""}
          </div>
        ) : null}

        <div className="space-y-3 p-4">
          {selected && !selected.isYou ? (
            <>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Selected
                </div>
                <button
                  type="button"
                  onClick={() => openContactModal(selected)}
                  className="mt-1 text-left text-sm font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  {selected.name}
                </button>
                {selected.firm ? (
                  <div className="text-xs text-muted-foreground">{selected.firm}</div>
                ) : null}
                {selected.title ? (
                  <div className="text-xs text-muted-foreground">{selected.title}</div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selected.isChannel ? (
                  <Pill>Referral channel</Pill>
                ) : selected.degree ? (
                  <Pill>Degree {selected.degree}</Pill>
                ) : (
                  <Pill>Source</Pill>
                )}
                {selected.tier ? <Pill>Tier {selected.tier}</Pill> : null}
                {selected.role ? (
                  <Pill>{NETWORK_ROLE_SHORT[selected.role] ?? selected.role}</Pill>
                ) : null}
                {selected.referralCount > 0 ? (
                  <Pill>{selected.referralCount} referred out</Pill>
                ) : null}
              </div>
              {selected.isChannel ? (
                <p className="text-xs text-muted-foreground">
                  People pointed at this node were introduced through{" "}
                  {selected.name}.
                </p>
              ) : null}
              {selectedChain.length > 1 ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Introduction path
                  </div>
                  <ol className="mt-2 space-y-1.5">
                    {selectedChain.map((hop, i) => {
                      const hopNode = nodesById.get(hop.id);
                      const canOpen = hopNode && !hopNode.isYou;
                      return (
                        <li
                          key={`${hop.id}-${i}`}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-medium">
                            {i + 1}
                          </span>
                          {canOpen ? (
                            <button
                              type="button"
                              onClick={() => openContactModal(hopNode)}
                              className="text-left font-medium text-foreground underline-offset-2 hover:underline"
                            >
                              {hop.name}
                            </button>
                          ) : (
                            <span>{hop.name}</span>
                          )}
                          {i < selectedChain.length - 1 ? (
                            <span className="text-muted-foreground">→</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No upstream referral recorded for this person.
                </p>
              )}
              <button
                type="button"
                onClick={() => openContactModal(selected)}
                className="inline-flex text-xs text-foreground underline-offset-2 hover:underline"
              >
                Open contact
              </button>
            </>
          ) : (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                Click a 1st-degree person to light up everyone they introduced —
                their 2nds and the 3rds those 2nds introduced.
              </p>
              <p>
                Deg filters keep intro-chain neighbors for context. Tier A / B /
                C shows only that relevance tier — nothing else.
              </p>
              <p>
                Drag any name box anywhere you want — it follows the cursor
                and sticks across sessions. Pan/zoom if you push past the
                edges. Use Reset layout to restore the rings.
              </p>
            </div>
          )}
        </div>
      </aside>

      {modalTarget ? (
        <OutreachModal
          open={Boolean(modalTarget)}
          onOpenChange={(open) => {
            if (!open) setModalTarget(null);
          }}
          contactId={modalTarget.id}
          initialDisplay={{
            name: modalTarget.name,
            title: modalTarget.title,
            firm: modalTarget.firm,
          }}
        />
      ) : null}
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
