/** Ten soft-anime field-guide residents standing in for 100 people. */
const RESIDENTS = [
  { id: "r1", cx: 42, cy: 118, fill: "#f0d7b0", accent: "#c6e355", hair: "#2a2430" },
  { id: "r2", cx: 62, cy: 122, fill: "#e8c4a0", accent: "#8b7cc9", hair: "#4a3428" },
  { id: "r3", cx: 82, cy: 116, fill: "#d9b08c", accent: "#e0897a", hair: "#1c1a22" },
  { id: "r4", cx: 102, cy: 120, fill: "#f3ead7", accent: "#c6e355", hair: "#6b4e3a" },
  { id: "r5", cx: 122, cy: 117, fill: "#e2c2aa", accent: "#8b7cc9", hair: "#2f2a38" },
  { id: "r6", cx: 142, cy: 121, fill: "#f0d7b0", accent: "#e0897a", hair: "#3d2c22" },
  { id: "r7", cx: 162, cy: 118, fill: "#d9b08c", accent: "#c6e355", hair: "#241f2a" },
  { id: "r8", cx: 182, cy: 123, fill: "#e8c4a0", accent: "#8b7cc9", hair: "#5a4030" },
  { id: "r9", cx: 202, cy: 119, fill: "#f3ead7", accent: "#e0897a", hair: "#2a2430" },
  { id: "r10", cx: 222, cy: 122, fill: "#e2c2aa", accent: "#c6e355", hair: "#4a3428" },
] as const;

type TownSceneProps = {
  figureNote: string;
};

export function TownScene({ figureNote }: TownSceneProps) {
  return (
    <figure className="iugr-town-scene">
      <svg
        className="iugr-town-svg"
        viewBox="0 0 280 168"
        role="img"
        aria-label="Original Town: a small illustrated settlement with a bakery, homes, trees, a fountain, and ten resident figures."
      >
        <defs>
          <linearGradient id="iugr-town-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#152038" />
            <stop offset="100%" stopColor="#0c1424" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="280" height="168" rx="18" fill="url(#iugr-town-sky)" />
        {/* Soft hills */}
        <ellipse cx="70" cy="128" rx="70" ry="22" fill="#1a2a20" opacity="0.7" />
        <ellipse cx="210" cy="130" rx="80" ry="24" fill="#1a2438" opacity="0.8" />
        <rect x="0" y="124" width="280" height="44" fill="#141e30" />

        {/* Town hall */}
        <rect x="118" y="78" width="44" height="36" rx="4" fill="#2a3550" stroke="#cbbfa8" strokeWidth="1" />
        <path d="M112 80h56l-10-16H122z" fill="#8b7cc9" />
        <rect x="134" y="96" width="12" height="18" rx="1.5" fill="#c6e355" opacity="0.75" />
        <circle cx="140" cy="72" r="3" fill="#f3ead7" opacity="0.7" />

        {/* Bakery */}
        <rect x="48" y="92" width="40" height="28" rx="3" fill="#2a3550" stroke="#cbbfa8" strokeWidth="1" />
        <path d="M42 94h52l-8-14H50z" fill="#e0897a" />
        <rect x="60" y="102" width="14" height="10" rx="1.5" fill="#c6e355" opacity="0.8" />
        <text x="55" y="90" fill="#f3ead7" fontSize="6" opacity="0.7">
          bakery
        </text>

        {/* Homes */}
        <rect x="178" y="96" width="28" height="22" rx="2" fill="#24324c" stroke="#cbbfa8" strokeWidth="0.8" />
        <path d="M174 98h36l-6-12h-24z" fill="#c6e355" opacity="0.65" />
        <rect x="218" y="100" width="24" height="18" rx="2" fill="#24324c" stroke="#cbbfa8" strokeWidth="0.8" />
        <path d="M214 102h32l-5-10h-22z" fill="#8b7cc9" />

        {/* Fountain */}
        <ellipse cx="140" cy="126" rx="10" ry="4" fill="#3a5078" />
        <rect x="138" y="116" width="4" height="10" fill="#cbbfa8" />
        <circle cx="140" cy="115" r="3" fill="#8b7cc9" opacity="0.8" />

        {/* Trees */}
        <circle cx="28" cy="108" r="10" fill="#2f5d45" />
        <rect x="26" y="114" width="4" height="12" fill="#5a4634" />
        <circle cx="258" cy="110" r="11" fill="#2f5d45" />
        <rect x="256" y="116" width="4" height="12" fill="#5a4634" />

        {/* Dormant copy machine at the edge */}
        <g className="iugr-dormant-machine">
          <rect x="236" y="70" width="30" height="34" rx="4" fill="#1c2438" stroke="#8b7cc9" strokeWidth="1" strokeDasharray="2 2" />
          <rect x="242" y="78" width="18" height="10" rx="2" fill="#0c1220" />
          <circle cx="251" cy="96" r="3" fill="#e0897a" className="iugr-machine-pilot" />
          <text x="238" y="66" fill="#cbbfa8" fontSize="5.5" opacity="0.75">
            COPY
          </text>
        </g>

        {/* Residents */}
        {RESIDENTS.map((r, i) => (
          <g key={r.id} className="iugr-resident" style={{ animationDelay: `${i * 0.08}s` }}>
            <ellipse cx={r.cx} cy={r.cy + 8} rx="5" ry="2" fill="#000" opacity="0.18" />
            <rect x={r.cx - 3.5} y={r.cy - 1} width="7" height="9" rx="2" fill={r.accent} opacity="0.85" />
            <circle cx={r.cx} cy={r.cy - 6} r="4.2" fill={r.fill} />
            <path
              d={`M${r.cx - 4.2} ${r.cy - 7} Q${r.cx} ${r.cy - 12} ${r.cx + 4.2} ${r.cy - 7}`}
              fill={r.hair}
            />
            <circle cx={r.cx - 1.4} cy={r.cy - 6} r="0.55" fill="#1c1a22" />
            <circle cx={r.cx + 1.4} cy={r.cy - 6} r="0.55" fill="#1c1a22" />
            <path
              d={`M${r.cx - 1.2} ${r.cy - 4.2} Q${r.cx} ${r.cy - 3.2} ${r.cx + 1.2} ${r.cy - 4.2}`}
              fill="none"
              stroke="#1c1a22"
              strokeWidth="0.45"
              strokeLinecap="round"
            />
          </g>
        ))}
      </svg>
      <figcaption className="iugr-field-annotation">{figureNote}</figcaption>
    </figure>
  );
}
