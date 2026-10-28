"use client";

import { useEffect, useId, useRef, useState } from "react";

const NS = "http://www.w3.org/2000/svg";

const TRACE_COLORS = {
  j1: "var(--viz-series-1)",
  j2: "var(--viz-series-2)",
  a: "var(--viz-series-3)",
  f: "var(--viz-series-4)",
  b: "var(--viz-series-5)",
} as const;

type Who = keyof typeof TRACE_COLORS;
type TraceValue = "all" | Who;

const TRACE_OPTIONS: { value: TraceValue; label: string }[] = [
  { value: "all", label: "All paths" },
  { value: "j1", label: "Jason 1 · original protagonist" },
  { value: "j2", label: "Jason 2 · abductor" },
  { value: "a", label: "Amanda 2 · traveling companion" },
  { value: "f", label: "Daniela 1 & Charlie 1" },
  { value: "b", label: "Other Jason branches" },
];

const LEGEND: { id: Who; label: string }[] = [
  { id: "j1", label: "Jason 1" },
  { id: "j2", label: "Jason 2" },
  { id: "a", label: "Amanda 2" },
  { id: "f", label: "Original family" },
  { id: "b", label: "Jason branches" },
];

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | undefined>,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) node.setAttribute(key, String(value));
  }
  parent?.append(node);
  return node;
}

function applyTrace(root: HTMLElement, who: TraceValue) {
  root.querySelectorAll<SVGElement>(".route").forEach((path) => {
    path.classList.toggle("mutedroute", who !== "all" && path.dataset.who !== who);
  });
}

function drawSeason(container: HTMLElement, season: 1 | 2, uid: string) {
  const width = container.clientWidth;
  if (width < 1) return;
  const narrow = width < 500;
  const height = season === 1 ? 880 : 1000;
  container.replaceChildren();

  const svg = svgEl(
    "svg",
    {
      viewBox: `0 0 ${width} ${height}`,
      height,
      role: "img",
      "aria-label":
        season === 1
          ? "Season one character paths: Jason 1 is displaced, travels with Amanda and reunites with his family."
          : "Season two paths: the family reaches World X, separates, and Jason reunites with Amanda, Ryan and Blair.",
    },
    container,
  );
  const defs = svgEl("defs", {}, svg);
  (Object.keys(TRACE_COLORS) as Who[]).forEach((who) => {
    const marker = svgEl(
      "marker",
      {
        id: `${uid}-${season}${who}`,
        viewBox: "0 0 8 8",
        refX: 7,
        refY: 4,
        markerWidth: 7,
        markerHeight: 7,
        orient: "auto-start-reverse",
      },
      defs,
    );
    svgEl("path", { d: "M0 0L8 4L0 8Z", fill: TRACE_COLORS[who] }, marker);
  });

  const nodeWidth = Math.min(narrow ? 142 : 210, width * 0.44);

  function node(
    x: number,
    y: number,
    title: string,
    sub: string,
    tokens: string[],
  ) {
    const group = svgEl("g", {}, svg);
    svgEl(
      "rect",
      {
        x: width * x - nodeWidth / 2,
        y: y - 47,
        width: nodeWidth,
        height: 94,
        rx: 18,
        class: "world-outline",
      },
      group,
    );
    const titleNode = svgEl(
      "text",
      { x: width * x, y: y - 23, "text-anchor": "middle", class: "world-title" },
      group,
    );
    titleNode.textContent = title;
    const subNode = svgEl(
      "text",
      { x: width * x, y: y - 5, "text-anchor": "middle", class: "sub" },
      group,
    );
    subNode.textContent = sub;
    const tokenWidth = Math.min(37, (nodeWidth - 14) / tokens.length);
    tokens.forEach((token, index) => {
      const cx = width * x + (index - (tokens.length - 1) / 2) * tokenWidth;
      svgEl("circle", { cx, cy: y + 22, r: 15, class: "token" }, group);
      const label = svgEl("text", { x: cx, y: y + 26, "text-anchor": "middle" }, group);
      label.textContent = token;
    });
  }

  const paths = svgEl("g", {}, svg);
  function route(
    who: Who,
    points: string,
    dash?: boolean,
    label?: string,
    labelX?: number,
    labelY?: number,
  ) {
    svgEl(
      "path",
      {
        d: points,
        class: "route",
        "data-who": who,
        stroke: TRACE_COLORS[who],
        "marker-end": `url(#${uid}-${season}${who})`,
        ...(dash ? { "stroke-dasharray": "6 6" } : {}),
      },
      paths,
    );
    if (label && labelX !== undefined && labelY !== undefined) {
      const text = svgEl(
        "text",
        { x: width * labelX, y: labelY, "text-anchor": "middle", class: "sub" },
        paths,
      );
      text.textContent = label;
    }
  }

  const x = (value: number) => width * value;

  if (season === 1) {
    node(0.25, 68, "HOME REALITY", "S1 E1 · Chicago", ["J1", "D1", "C1", "R1"]);
    node(0.75, 68, "VELOCITY REALITY", "S1 E1–3 · lab / art world", ["J2", "A2", "L2", "D2"]);
    route("j1", `M${x(0.25)} 29 Q${x(0.5)} -16 ${x(0.75)} 29`, false, "J2 abducts J1", 0.5, 13);
    route("j2", `M${x(0.75)} 114 Q${x(0.5)} 184 ${x(0.25)} 114`, false, "J2 takes J1’s life", 0.5, 159);
    node(0.5, 251, "THE CORRIDOR", "S1 E4 · escape + navigation", ["J1", "A2"]);
    route("j1", `M${x(0.72)} 116 L${x(0.72)} 188 L${x(0.49)} 204`);
    route("a", `M${x(0.78)} 116 L${x(0.78)} 194 L${x(0.53)} 204`);
    node(0.21, 417, "HOSTILE WORLDS", "Frozen + lethal Chicagos", ["J1", "A2"]);
    node(0.79, 417, "PANDEMIC WORLD", "S1 E5 · dying Daniela", ["J1", "A2", "D*"]);
    route("j1", `M${x(0.47)} 298 L${x(0.21)} 369`);
    route("a", `M${x(0.52)} 298 L${x(0.25)} 369`);
    route(
      "j1",
      `M${x(0.21)} 465 L${x(0.21)} 501 L${x(0.79)} 501 L${x(0.79)} 465`,
      true,
      "Blair 2 in insect world; other stops grouped",
      0.5,
      527,
    );
    route("a", `M${x(0.25)} 465 L${x(0.25)} 488 L${x(0.75)} 488 L${x(0.75)} 465`, true);
    node(0.5, 618, "PROGRESSIVE WORLD", "S1 E7 · paths split", ["J1", "A2"]);
    route("j1", `M${x(0.76)} 465 L${x(0.76)} 550 L${x(0.48)} 570`);
    route("a", `M${x(0.81)} 465 L${x(0.81)} 556 L${x(0.53)} 570`);
    node(0.82, 795, "AMANDA STAYS", "Her own chosen home", ["A2"]);
    node(0.25, 795, "HOME · RETURN", "S1 E7–9 · many Jasons", ["J1", "D1", "C1", "J2"]);
    route("a", `M${x(0.54)} 665 L${x(0.82)} 747`);
    route("j1", `M${x(0.46)} 665 L${x(0.25)} 747`, false, "J1 continues alone", 0.25, 704);
    route("b", `M${x(0.08)} 605 L${x(0.08)} 690 L${x(0.16)} 747`, true, "Other J1 branches", 0.14, 580);
  } else {
    node(0.5, 62, "FAMILY ESCAPES", "From S1 finale · Charlie’s door", ["J1", "D1", "C1"]);
    node(0.5, 221, "SECLUDED REFUGE", "S2 E1 · another Jason killed", ["J1", "D1", "C1"]);
    route("j1", `M${x(0.48)} 110 V173`);
    route("f", `M${x(0.52)} 110 V173`);
    node(0.5, 400, "WORLD X", "S2 E2–9 · analog Chicago", ["J1", "D1", "C1"]);
    route("j1", `M${x(0.48)} 269 V352`);
    route("f", `M${x(0.52)} 269 V352`, false, "The family settles again", 0.73, 308);
    node(0.18, 568, "LOCAL AMANDA", "Diner owner · Eduardo’s mom", ["AX"]);
    node(0.82, 568, "JASON 2", "After his separate travels", ["J2"]);
    route("j1", `M${x(0.45)} 448 L${x(0.18)} 520`, false, "Meets local version", 0.22, 486);
    route("j2", `M${x(0.82)} 616 L${x(0.82)} 835 L${x(0.61)} 895`, true);
    node(0.24, 735, "FAMILY SEPARATES", "Charlie leaves; Daniela follows", ["D1", "C1"]);
    route("f", `M${x(0.46)} 448 L${x(0.35)} 478 L${x(0.35)} 668 L${x(0.24)} 687`);
    node(0.68, 943, "WORLD X · REUNION", "S2 E9 · disable the original Box", [
      "J1",
      "A2",
      "R1",
      "B2",
    ]);
    route("j1", `M${x(0.18)} 616 L${x(0.08)} 650 L${x(0.08)} 861 L${x(0.56)} 895`, false, "J1 remains in World X", 0.3, 854);
    route("a", `M${x(0.97)} 88 L${x(0.97)} 860 L${x(0.75)} 895`, true, "A2 + R1 return", 0.83, 68);
    node(0.21, 943, "ELSEWHERE", "D1 with J13 · C1 finds Max", ["D1", "J13", "C1", "M*"]);
    route("f", `M${x(0.24)} 783 L${x(0.21)} 895`);
    node(0.79, 735, "OTHER J1 BRANCHES", "E5: mother / Maria · E8: Laurel", ["J*", "A*"]);
    route("b", `M${x(0.79)} 783 L${x(0.79)} 815`, true);
  }

  svg.insertBefore(paths, defs.nextSibling);
  const title = svgEl("title", {}, svg);
  title.textContent =
    "Character tokens: J Jason, D Daniela, C Charlie, R Ryan, A Amanda, B Blair, L Leighton. Numbers identify versions; asterisk means another variant; X means local World X version.";
}

export function DarkMatterWorldMap() {
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const seasonOneRef = useRef<HTMLDivElement>(null);
  const seasonTwoRef = useRef<HTMLDivElement>(null);
  const [trace, setTrace] = useState<TraceValue>("all");

  useEffect(() => {
    const root = rootRef.current;
    const seasonOne = seasonOneRef.current;
    const seasonTwo = seasonTwoRef.current;
    if (!root || !seasonOne || !seasonTwo) return;

    const draw = () => {
      drawSeason(seasonOne, 1, uid);
      drawSeason(seasonTwo, 2, uid);
      applyTrace(root, trace);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(seasonOne);
    observer.observe(seasonTwo);
    return () => observer.disconnect();
  }, [trace, uid]);

  return (
    <div id="dark-worlds" ref={rootRef}>
      <h2>Dark Matter · Worlds, versions &amp; crossings</h2>
      <div className="text-small text-muted">
        Spoilers through S2 E9 · Arrows follow story order, not geographic distance.
      </div>
      <div className="viz-controls">
        <label className="form-label">
          Trace a character{" "}
          <select
            className="form-select"
            value={trace}
            onChange={(event) => setTrace(event.target.value as TraceValue)}
          >
            {TRACE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div id="dm-key" className="viz-row text-small">
        {LEGEND.map((item) => (
          <span className="legenditem" key={item.id}>
            <span className="legendmark" style={{ background: TRACE_COLORS[item.id] }} />
            {item.label}
          </span>
        ))}
      </div>
      <h3>Season 1 · The swap, the search, the escape</h3>
      <div ref={seasonOneRef} className="worldgraph" />
      <h3>Season 2 · A family separates; old paths converge</h3>
      <div ref={seasonTwoRef} className="worldgraph" />
      <div className="text-small text-muted">
        J = Jason · D = Daniela · C = Charlie · A = Amanda · R = Ryan · B = Blair · L =
        Leighton · M = Max
      </div>
      <div className="text-small text-muted">
        1 / 2 = version · * = another variant · X = local World X version. Solid arrow: route
        or direct continuation. Dashed arrow: intervening travel omitted. Minor stops are
        grouped. S2 E10 has not aired.
      </div>
    </div>
  );
}
